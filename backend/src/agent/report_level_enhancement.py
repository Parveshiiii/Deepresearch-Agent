"""
Report-Level Content Enhancement Module

During the final report generation phase, the LLM may discover it needs more in-depth specific 
information to support its analysis. This module provides the capability to perform targeted 
content enhancement during the report generation process.
"""

import os
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.runnables import RunnableConfig
from firecrawl import FirecrawlApp


@dataclass
class ReportEnhancementRequest:
    """Report enhancement request"""
    enhancement_type: str  # "specific_data", "case_study", "technical_details", "market_data"
    target_information: str  # Specific description of needed information
    suggested_sources: List[str]  # Suggested source URLs
    priority: int  # Priority level 1-5
    reasoning: str  # LLM's reasoning process


@dataclass
class ReportEnhancementResult:
    """Report enhancement result"""
    success: bool
    enhanced_content: str
    sources_used: List[Dict[str, Any]]
    enhancement_quality: str  # "excellent", "good", "fair", "poor"


class ReportLevelEnhancer:
    """Report-level content enhancer"""
    
    def __init__(self):
        self.firecrawl_app = None
        if os.getenv("FIRECRAWL_API_KEY"):
            self.firecrawl_app = FirecrawlApp(api_key=os.getenv("FIRECRAWL_API_KEY"))
    
    def analyze_report_enhancement_needs(
        self, 
        user_query: str,
        research_plan: List[Dict],
        aggregated_research_data: str,
        config: RunnableConfig
    ) -> List[ReportEnhancementRequest]:
        """
        Analyze additional information needed during report writing process
        
        This is a pre-analysis step that allows the LLM to identify information gaps 
        before formal writing begins
        """
        
        enhancement_analysis_prompt = f"""You are a professional research report writing expert. Before writing the final report, please analyze whether the current research data is sufficiently complete and identify additional in-depth information that may be needed.

User Query: {user_query}

Research Plan:
{chr(10).join([f"• {task.get('description', '')}" for task in research_plan])}

Current Research Data Overview:
{aggregated_research_data[:2000]}...

Please analyze the information adequacy in the following dimensions and identify areas that need deep enhancement:

1. **Specific Data & Statistics** - Is there sufficient quantitative data to support the analysis?
2. **Implementation Cases & Technical Details** - Are there specific implementation examples?
3. **Market Data & Competitive Analysis** - Is there latest market sizing and competitive landscape data?
4. **Policies, Regulations & Standards** - Is the relevant regulatory framework covered?

For each area that needs enhancement, please output in the following format:

**ENHANCEMENT_REQUEST_START**
Type: [specific_data|case_study|technical_details|market_data|regulatory_info]
Target: [What specific information is needed]
Priority: [1-5 number]
Reasoning: [Why this information is needed and how it will improve report quality]
Suggested_Sources: [Suggested website types or specific URLs if known that might have this information]
**ENHANCEMENT_REQUEST_END**

If current information is already sufficient, output: **NO_ENHANCEMENT_NEEDED**

Please identify only the most critical 1-3 enhancement needs to avoid over-complication.
"""
        
        from agent.configuration import Configuration
        configurable = Configuration.from_runnable_config(config)
        
        llm = ChatGoogleGenerativeAI(
            model=configurable.reflection_model,
            temperature=0.3,
            max_retries=2,
            api_key=os.getenv("GEMINI_API_KEY"),
        )
        
        response = llm.invoke(enhancement_analysis_prompt)
        analysis_text = response.content if hasattr(response, 'content') else str(response)
        
        return self._parse_enhancement_requests(analysis_text)
    
    def _parse_enhancement_requests(self, analysis_text: str) -> List[ReportEnhancementRequest]:
        """Parse LLM's enhancement requests"""
        requests = []
        
        if "NO_ENHANCEMENT_NEEDED" in analysis_text:
            return requests
        
        import re
        
        # Extract all enhancement request blocks
        pattern = r'\*\*ENHANCEMENT_REQUEST_START\*\*(.*?)\*\*ENHANCEMENT_REQUEST_END\*\*'
        matches = re.findall(pattern, analysis_text, re.DOTALL)
        
        for match in matches:
            try:
                request_data = self._parse_single_request(match)
                if request_data:
                    requests.append(request_data)
            except Exception as e:
                print(f"⚠️ Failed to parse enhancement request: {e}")
                continue
        
        return requests[:3]  # Maximum 3 requests
    
    def _parse_single_request(self, request_text: str) -> Optional[ReportEnhancementRequest]:
        """Parse a single enhancement request"""
        lines = request_text.strip().split('\n')
        
        enhancement_type = ""
        target_information = ""
        priority = 3
        reasoning = ""
        suggested_sources = []
        
        for line in lines:
            line = line.strip()
            if line.startswith('Type:'):
                enhancement_type = line.replace('Type:', '').strip()
            elif line.startswith('Target:'):
                target_information = line.replace('Target:', '').strip()
            elif line.startswith('Priority:'):
                try:
                    priority = int(line.replace('Priority:', '').strip())
                except:
                    priority = 3
            elif line.startswith('Reasoning:'):
                reasoning = line.replace('Reasoning:', '').strip()
            elif line.startswith('Suggested_Sources:'):
                sources_text = line.replace('Suggested_Sources:', '').strip()
                # Simple split, could be more complex in practice
                suggested_sources = [s.strip() for s in sources_text.split(',') if s.strip()]
        
        if enhancement_type and target_information:
            return ReportEnhancementRequest(
                enhancement_type=enhancement_type,
                target_information=target_information,
                suggested_sources=suggested_sources,
                priority=priority,
                reasoning=reasoning
            )
        
        return None
    
    def execute_targeted_enhancement(
        self, 
        enhancement_requests: List[ReportEnhancementRequest],
        available_sources: List[Dict[str, Any]]
    ) -> List[ReportEnhancementResult]:
        """Execute targeted content enhancement"""
        
        if not self.firecrawl_app:
            print("⚠️ Firecrawl not configured, skipping report-level enhancement")
            return []
        
        results = []
        
        for request in enhancement_requests:
            print(f"🎯 Executing report-level enhancement: {request.enhancement_type}")
            print(f"   Target information: {request.target_information}")
            
            # Find matching URLs
            target_urls = self._find_matching_urls(request, available_sources)
            
            if not target_urls:
                print(f"   ❌ No matching information sources found")
                continue
            
            # Attempt enhancement
            enhanced_content = ""
            sources_used = []
            
            for url_info in target_urls[:2]:  # Try at most 2 URLs
                try:
                    url = url_info.get('url', '')
                    if not url:
                        continue
                    
                    print(f"   🔥 Scraping: {url_info.get('title', 'Unknown')}")
                    
                    result = self.firecrawl_app.scrape_url(url, params={
                        'formats': ['markdown'],
                        'onlyMainContent': True,
                        'timeout': 30000
                    })
                    
                    if result and result.success:
                        content = result.markdown or ''
                        if len(content) > 500:  # Valid content
                            enhanced_content += f"\n\n### Source: {url_info.get('title', 'Unknown')}\n{content[:2000]}..."
                            sources_used.append({
                                'url': url,
                                'title': url_info.get('title', ''),
                                'content_length': len(content)
                            })
                            print(f"     ✅ Success: {len(content)} characters")
                        else:
                            print(f"     ⚠️ Content too short: {len(content)} characters")
                    else:
                        print(f"     ❌ Scraping failed")
                        
                except Exception as e:
                    print(f"     ❌ Scraping exception: {str(e)}")
                    continue
            
            if enhanced_content and sources_used:
                quality = self._assess_enhancement_quality(enhanced_content, request)
                results.append(ReportEnhancementResult(
                    success=True,
                    enhanced_content=enhanced_content,
                    sources_used=sources_used,
                    enhancement_quality=quality
                ))
                print(f"   ✅ Enhancement completed, quality: {quality}")
            else:
                results.append(ReportEnhancementResult(
                    success=False,
                    enhanced_content="",
                    sources_used=[],
                    enhancement_quality="failed"
                ))
                print(f"   ❌ Enhancement failed")
        
        return results
    
    def _find_matching_urls(
        self, 
        request: ReportEnhancementRequest, 
        available_sources: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Find URLs matching the enhancement request"""
        
        target_keywords = request.target_information.lower().split()
        enhancement_type = request.enhancement_type
        
        scored_sources = []
        
        for source in available_sources:
            title = source.get('title', '').lower()
            url = source.get('url', '').lower()
            
            score = 0
            
            # Keyword matching
            for keyword in target_keywords:
                if keyword in title:
                    score += 2
                if keyword in url:
                    score += 1
            
            # Type matching
            type_scoring = {
                'specific_data': ['data', 'statistics', 'report', 'research', 'study'],
                'case_study': ['case', 'example', 'implementation', 'deployment', 'success'],
                'technical_details': ['technical', 'specification', 'documentation', 'guide', 'manual'],
                'market_data': ['market', 'industry', 'competition', 'analysis', 'forecast'],
                'regulatory_info': ['regulation', 'policy', 'standard', 'compliance', 'legal']
            }
            
            type_keywords = type_scoring.get(enhancement_type, [])
            for keyword in type_keywords:
                if keyword in title or keyword in url:
                    score += 1
            
            # Authority bonus
            if any(domain in url for domain in ['.gov', '.edu', '.org']):
                score += 3
            
            if score > 0:
                scored_sources.append((source, score))
        
        # Sort by score
        scored_sources.sort(key=lambda x: x[1], reverse=True)
        
        return [source for source, score in scored_sources if score >= 2]
    
    def _assess_enhancement_quality(
        self, 
        content: str, 
        request: ReportEnhancementRequest
    ) -> str:
        """Assess enhancement content quality"""
        
        if not content:
            return "poor"
        
        length = len(content)
        target_keywords = request.target_information.lower().split()
        
        # Keyword matching rate
        keyword_matches = sum(1 for keyword in target_keywords if keyword in content.lower())
        keyword_ratio = keyword_matches / len(target_keywords) if target_keywords else 0
        
        # Length assessment
        if length > 2000 and keyword_ratio > 0.6:
            return "excellent"
        elif length > 1000 and keyword_ratio > 0.4:
            return "good" 
        elif length > 500 and keyword_ratio > 0.2:
            return "fair"
        else:
            return "poor"


def integrate_report_enhancement_into_finalize(
    user_query: str,
    research_plan: List[Dict],
    aggregated_research_data: str,
    available_sources: List[Dict[str, Any]],
    config: RunnableConfig
) -> Tuple[str, List[ReportEnhancementResult]]:
    """
    Integrate report-level enhancement into finalize_answer process
    
    Returns: (enhanced_research_data, enhancement_results)
    """
    
    enhancer = ReportLevelEnhancer()
    
    # 1. Analyze enhancement needs
    enhancement_requests = enhancer.analyze_report_enhancement_needs(
        user_query, research_plan, aggregated_research_data, config
    )
    
    if not enhancement_requests:
        print("✅ Report-level analysis: Current information is sufficient, no additional enhancement needed")
        return aggregated_research_data, []
    
    print(f"🎯 Identified {len(enhancement_requests)} report-level enhancement needs")
    for i, req in enumerate(enhancement_requests, 1):
        print(f"   {i}. {req.enhancement_type}: {req.target_information}")
    
    # 2. Execute enhancement
    enhancement_results = enhancer.execute_targeted_enhancement(
        enhancement_requests, available_sources
    )
    
    # 3. Merge enhanced content
    enhanced_data = aggregated_research_data
    
    successful_enhancements = [r for r in enhancement_results if r.success]
    if successful_enhancements:
        enhanced_sections = []
        for result in successful_enhancements:
            enhanced_sections.append(f"\n\n## Report-Level Deep Enhancement\n{result.enhanced_content}")
        
        enhanced_data += "\n" + "\n".join(enhanced_sections)
        print(f"✅ Report-level enhancement completed: {len(successful_enhancements)} successful")
    else:
        print("⚠️ Report-level enhancement did not yield effective content")
    
    return enhanced_data, enhancement_results 