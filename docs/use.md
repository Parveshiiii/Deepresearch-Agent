# LangGraph Deep Research - Usage Guide

This document provides detailed information about environment variables, configurations, and important implementation details for the LangGraph Deep Research project.

## Environment Variables

### Required API Keys

1. **`GEMINI_API_KEY`**
   - **Purpose**: API key for Google's Gemini language models
   - **Used for**:
     - Query generation
     - Reflection and reasoning
     - Final answer generation
     - Content enhancement decisions
   - **How to get**: Obtain from [Google AI Studio](https://aistudio.google.com/)
   - **Example**: `export GEMINI_API_KEY="your-api-key-here"`

2. **`FIRECRAWL_API_KEY`**
   - **Purpose**: API key for Firecrawl web crawling service
   - **Used for**:
     - Deep content crawling
     - Content enhancement
     - Report-level information gathering
   - **Note**: Optional but recommended for enhanced research capabilities
   - **How to get**: Sign up at [Firecrawl](https://firecrawl.dev/)
   - **Example**: `export FIRECRAWL_API_KEY="your-api-key-here"`

### Optional Configuration

These can be set as environment variables or passed in the configuration:

1. **Model Selection**
   - `QUERY_GENERATOR_MODEL`: Model for search query generation (default: `gemini-2.5-flash-preview-04-17`)
   - `REFLECTION_MODEL`: Model for reflection and reasoning (default: `gemini-2.5-flash-preview-04-17`)
   - `ANSWER_MODEL`: Model for final answer generation (default: `gemini-2.5-flash-preview-04-17`)

2. **Research Parameters**
   - `NUMBER_OF_INITIAL_QUERIES`: Number of search queries to generate initially (default: `6`)
   - `MAX_RESEARCH_LOOPS`: Maximum research iterations before finalizing (default: `8`)

## Important Configurations

### URL Priority Scoring

The system uses a priority scoring mechanism to determine which URLs to enhance. The scoring is based on:

```python
def _calculate_url_priority(self, source: Dict[str, Any]) -> float:
    score = 0.0
    
    # Official websites and documentation
    if any(domain in url for domain in [".gov", ".edu", ".org"]):
        score += 0.4
    
    # Well-known platforms
    if any(platform in url for platform in ["wikipedia", "arxiv", "ieee", "acm"]):
        score += 0.3
    
    # Technical content indicators
    if any(keyword in title for keyword in ["report", "study", "research", "analysis", "technical"]):
        score += 0.2
    
    # Company websites
    if any(company in url for company in ["google", "microsoft", "amazon", "tesla", "nvidia"]):
        score += 0.2
    
    # Base score
    score += 0.1
    
    return min(score, 1.0)
```

### Content Enhancement

Content enhancement is triggered based on:
1. Availability of `FIRECRAWL_API_KEY`
2. Research loop count (skips first loop)
3. Previous enhancement status
4. Minimum content availability

### Report Generation

The system uses a multi-stage approach for report generation:
1. Initial research and data gathering
2. Content enhancement (if enabled)
3. Holistic integration of findings
4. Final refinement and formatting

## Getting Started

1. Set up your environment variables:
   ```bash
   # Required
   export GEMINI_API_KEY="your-gemini-key"
   
   # Optional but recommended
   export FIRECRAWL_API_KEY="your-firecrawl-key"
   
   # Optional overrides
   export NUMBER_OF_INITIAL_QUERIES=8
   export MAX_RESEARCH_LOOPS=5
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the application:
   ```bash
   python -m agent.app
   ```

## Troubleshooting

- If you see errors about missing API keys, ensure both `GEMINI_API_KEY` and (optionally) `FIRECRAWL_API_KEY` are set
- For rate limiting issues, consider implementing retry logic or upgrading your API plan
- Check logs for specific error messages and refer to the relevant API documentation

## Advanced Configuration

For more advanced use cases, you can create a custom configuration:

```python
from agent.configuration import Configuration

custom_config = Configuration(
    query_generator_model="gemini-2.5-pro",
    reflection_model="gemini-2.5-pro",
    answer_model="gemini-2.5-pro",
    number_of_initial_queries=8,
    max_research_loops=5
)
```

## License

Refer to the project's LICENSE file for usage and distribution terms.
