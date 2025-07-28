"""
Enhanced Graph Nodes - Integrates intelligent Firecrawl content enhancement
"""

import os
import json
from typing import List, Dict, Any
from datetime import datetime
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import AIMessage

from agent.state import OverallState, ReflectionState
from agent.content_enhancement_decision import (
    get_content_enhancement_decision_maker,
    EnhancementDecision
)
from agent.utils import get_research_topic


def content_enhancement_analysis(state: OverallState, config: RunnableConfig) -> dict:
    """
    Intelligent content enhancement analysis node - Decides whether to use Firecrawl for deep crawling
    
    This node will:
    1. Analyze the quality of current research results
    2. Evaluate if deep content enhancement is needed
    3. Select priority URLs for Firecrawl crawling
    4. Execute content enhancement (if needed)
    5. Merge enhanced content into research results
    """
    
    try:
        # Get current research context
        plan = state.get("plan", [])
        current_pointer = state.get("current_task_pointer", 0)
        
        # Determine research topic
        if plan and current_pointer < len(plan):
            research_topic = plan[current_pointer]["description"]
        else:
            research_topic = state.get("user_query") or get_research_topic(state["messages"])
        
        # Get current research findings
        current_findings = state.get("web_research_result", [])
        
        # Get grounding sources (extracted from recent search results)
        grounding_sources = []
        sources_gathered = state.get("sources_gathered", [])
        for source in sources_gathered[-10:]:  # 最近的10个源
            if isinstance(source, dict):
                grounding_sources.append({
                    "title": source.get("title", ""),
                    "url": source.get("url", ""),
                    "snippet": source.get("snippet", "")
                })
        
        print("🤔 Analyzing content enhancement needs...")
        print(f"  Research Topic: {research_topic}")
        print(f"  Current Findings Count: {len(current_findings)}")
        print(f"  Available Sources: {len(grounding_sources)}")
        
        # Use intelligent decision maker for analysis
        decision = get_content_enhancement_decision_maker().analyze_enhancement_need(
            research_topic=research_topic,
            current_findings=current_findings,
            grounding_sources=grounding_sources,
            config=config
        )
        
        print(f"📊 Enhancement Decision Results:")
        print(f"  Enhancement Needed: {decision.needs_enhancement}")
        print(f"  Confidence: {decision.confidence_score:.2f}")
        print(f"  Enhancement Type: {decision.enhancement_type}")
        print(f"  Priority URLs Count: {len(decision.priority_urls)}")
        
        # Save decision to state
        state_update = {
            "enhancement_decision": {
                "needs_enhancement": decision.needs_enhancement,
                "confidence_score": decision.confidence_score,
                "enhancement_type": decision.enhancement_type,
                "reasoning": decision.reasoning,
                "priority_urls": decision.priority_urls
            }
        }
        
        # If no enhancement needed, return directly
        if not decision.needs_enhancement:
            print("✅ Current content quality is sufficient, no enhancement needed")
            state_update["enhancement_status"] = "skipped"
            return state_update
        
        # Skip enhancement if no Firecrawl API Key
        if not get_content_enhancement_decision_maker().firecrawl_app:
            print("⚠️ Missing FIRECRAWL_API_KEY, skipping content enhancement")
            state_update["enhancement_status"] = "skipped_no_api"
            return state_update
        
        # Execute content enhancement
        print(f"🔥 Executing Firecrawl content enhancement...")
        enhanced_results = []
        
        # Synchronous call (simplified for now, can be made async later)
        for url_info in decision.priority_urls:
            url = url_info.get("url")
            if not url:
                continue
            
            try:
                print(f"  Crawling: {url_info.get('title', 'Unknown')}")
                
                result = get_content_enhancement_decision_maker().firecrawl_app.scrape_url(url)
                
                if result and result.success:
                    markdown_content = result.markdown or ''
                    
                    enhanced_results.append({
                        "url": url,
                        "title": url_info.get("title", ""),
                        "original_priority": url_info.get("priority_score", 0),
                        "enhanced_content": markdown_content,
                        "content_length": len(markdown_content),
                        "source_type": "firecrawl_enhanced",
                        "timestamp": datetime.now().isoformat()
                    })
                    
                    print(f"    ✅ Success: {len(markdown_content)} characters")
                else:
                    print(f"    ❌ Failed: {result.error if hasattr(result, 'error') else 'Unknown error'}")
                    
            except Exception as e:
                print(f"    ❌ Exception: {str(e)}")
                continue
        
        if enhanced_results:
            # Add enhanced content to research results
            enhanced_contents = []
            for result in enhanced_results:
                # Format enhanced content
                formatted_content = f"""

## Deep Content Enhancement - {result['title']}

Source: {result['url']}
Content Length: {result['content_length']} characters

{result['enhanced_content'][:3000]}{'...' if len(result['enhanced_content']) > 3000 else ''}

---
"""
                enhanced_contents.append(formatted_content)
            
            state_update.update({
                "enhanced_content_results": enhanced_results,
                "web_research_result": enhanced_contents,  # Add to research results
                "enhancement_status": "completed",
                "enhanced_sources_count": len(enhanced_results)
            })
            
            print(f"✅ Content enhancement completed: {len(enhanced_results)} sources")
        else:
            print("❌ Content enhancement failed, no content was successfully crawled")
            state_update["enhancement_status"] = "failed"
        
        return state_update
        
    except Exception as e:
        error_message = f"Content enhancement analysis node exception: {str(e)}"
        print(f"❌ {error_message}")
        return {
            "enhancement_status": "error",
            "enhancement_error": error_message
        }


def should_enhance_content(state: OverallState) -> str:
    """
    Conditional edge function - Decides whether to enter content enhancement flow
    
    Based on the following conditions:
    1. Whether Firecrawl API Key is configured
    2. Current research loop count
    3. User-configured enhancement preferences
    """
    
    # Check Firecrawl availability
    if not os.getenv("FIRECRAWL_API_KEY"):
        print("Skipping content enhancement: FIRECRAWL_API_KEY is not configured")
        return "continue_without_enhancement"
    
    # Check research loop count (avoid enhancing in early loops)
    research_loop_count = state.get("research_loop_count", 0)
    if research_loop_count < 1:  # At least one research loop should be completed before considering enhancement
        print(f"Skipping content enhancement: Research loop count is insufficient ({research_loop_count})")
        return "continue_without_enhancement"
    
    # Check if enhancement was already performed (avoid duplicate enhancement)
    if state.get("enhancement_status") in ["completed", "skipped"]:
        print("Skipping content enhancement: Enhancement was already completed")
        return "continue_without_enhancement"
    
    # Check current findings count (at least some basic content should be available)
    current_findings = state.get("web_research_result", [])
    if len(current_findings) < 1:
        print("⚠️ Skipping content enhancement: Missing basic research content")
        return "continue_without_enhancement"
    
    print("✅ Enhancement conditions met, proceeding to content enhancement analysis")
    return "analyze_enhancement_need"


def enhanced_reflection(state: OverallState, config: RunnableConfig) -> ReflectionState:
    """
    Enhanced reflection node - Considers content enhancement results in addition to basic reflection
    """
    
    # First call the original reflection logic
    from agent.graph import reflection
    reflection_result = reflection(state, config)
    
    # If content enhancement was performed, adjust the reflection judgment
    enhancement_status = state.get("enhancement_status")
    enhanced_sources_count = state.get("enhanced_sources_count", 0)
    
    if enhancement_status == "completed" and enhanced_sources_count > 0:
        print(f"📈 Content enhancement completed, adjusting reflection judgment")
        print(f"  Enhanced {enhanced_sources_count} sources")
        
        # If content enhancement was successful, be more inclined to consider the information sufficient
        # But still maintain the LLM's judgment weight
        if not reflection_result["is_sufficient"]:
            # Add some "bonus points" for enhanced content
            enhancement_boost = min(enhanced_sources_count * 0.3, 0.8)
            print(f"  Boosting sufficiency assessment due to content enhancement (+{enhancement_boost:.1f})")
            
            # If enhancement is significant, change "insufficient" to "sufficient"
            if enhancement_boost >= 0.6:
                print("  ✅ Based on content enhancement results, information is now sufficient")
                reflection_result["is_sufficient"] = True
                reflection_result["knowledge_gap"] = "Content has been sufficiently supplemented through deep crawling"
    
    elif enhancement_status == "skipped":
        print("📝 Content enhancement was skipped, using original reflection results")
    
    elif enhancement_status == "failed":
        print("⚠️ Content enhancement failed, may need more research loops")
    
    return reflection_result


# Helper function: Format enhancement decision info for logging
def format_enhancement_decision_log(decision: EnhancementDecision) -> str:
    """Format enhancement decision info for log output"""
    
    log_lines = [
        f"📊 Content Enhancement Decision Report:",
        f"  Decision: {'Enhancement Needed' if decision.needs_enhancement else 'No Enhancement Needed'}",
        f"  Confidence: {decision.confidence_score:.2f}",
        f"  Enhancement Type: {decision.enhancement_type}",
        f"  Priority URLs Count: {len(decision.priority_urls)}"
    ]
    
    if decision.priority_urls:
        log_lines.append("  Priority URLs:")
        for i, url_info in enumerate(decision.priority_urls, 1):
            log_lines.append(f"    {i}. {url_info.get('title', 'N/A')} (Score: {url_info.get('priority_score', 0):.2f})")
    
    log_lines.append(f"  Reasoning: {decision.reasoning[:200]}...")
    
    return "\n".join(log_lines) 