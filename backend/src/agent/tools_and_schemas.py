from typing import List
from pydantic import BaseModel, Field


class SearchQueryList(BaseModel):
    query: List[str] = Field(
        description="A list of search queries to be used for web research."
    )
    rationale: str = Field(
        description="A brief explanation of why these queries are relevant to the research topic."
    )


class Reflection(BaseModel):
    is_sufficient: bool = Field(
        description="Whether the provided summaries are sufficient to answer the user's question."
    )
    knowledge_gap: str = Field(
        description="A description of what information is missing or needs clarification."
    )
    follow_up_queries: List[str] = Field(
        description="A list of follow-up queries to address the knowledge gap."
    )


class ResearchTask(BaseModel):
    id: str = Field(description="Unique identifier for the task.")
    description: str = Field(description="A concise description of what this research task aims to achieve.")


class ResearchPlan(BaseModel):
    tasks: List[ResearchTask] = Field(description="A list of research tasks to be executed.")


class LedgerEntry(BaseModel):
    """Record of completed task findings for the ledger."""
    task_id: str = Field(description="Unique identifier of the completed task")
    description: str = Field(description="Original task description")
    findings_summary: str = Field(description="Concise summary of key findings for this task")
