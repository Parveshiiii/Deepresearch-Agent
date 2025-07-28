/**
 * Data Transformer: Converts flat event streams into hierarchical task structures
 */

// Type definitions
export interface EventData {
  [key: string]: unknown;
}

export interface SourceData {
  title?: string;
  url?: string;
  label?: string;
  snippet?: string;
}

export interface TaskData {
  id: string;
  description: string;
  status?: string;
}

export interface StateData {
  plan?: TaskData[];
  ledger?: TaskData[];
  current_task_pointer?: number;
  [key: string]: unknown;
}

export interface TaskDetail {
  taskId: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  steps: TaskStep[];
}

export interface TaskStep {
  type: 'planning' | 'query_generation' | 'web_research' | 'reflection' | 'content_enhancement' | 'evaluation' | 'completion';
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  timestamp?: string;
  data?: EventData;
  details?: StepDetail[];
}

export interface StepDetail {
  type: 'search_queries' | 'sources' | 'analysis' | 'decision';
  content: string;
  metadata?: {
    count?: number;
    sources?: SourceData[];
    is_sufficient?: boolean;
    knowledge_gap?: string;
    follow_up_queries?: string[];
    status?: string;
    decision?: string;
    [key: string]: unknown;
  };
}

export interface PlanningInfo {
  totalTasks: number;
  currentTaskIndex: number;
  tasks: Array<{
    id: string;
    description: string;
    status: string;
  }>;
}

export interface ProcessedResearchData {
  planning: PlanningInfo | null;
  tasks: TaskDetail[];
  currentTaskId: string | null;
  overallStatus: 'planning' | 'researching' | 'completed';
}

/**
 * Main transformation function: Converts event streams into hierarchical structure
 */
export function transformEventsToHierarchy(
  events: EventData[],
  messages: EventData[]
): ProcessedResearchData {
  
  console.log(`🔄 Starting to transform ${events.length} events`);
  
  // Count event types
  const eventTypes: Record<string, number> = {};
  events.forEach(event => {
    Object.keys(event).forEach(key => {
      eventTypes[key] = (eventTypes[key] || 0) + 1;
    });
  });
  
  console.log(`📊 Event type statistics:`, eventTypes);
  
  // Initialize result structure
  const result: ProcessedResearchData = {
    planning: null,
    tasks: [],
    currentTaskId: null,
    overallStatus: 'planning'
  };

  // Collect all state information
  let latestState: StateData = {};
  
  // Extract the latest state from events
  events.forEach(event => {
    Object.keys(event).forEach(key => {
      if (event[key] && typeof event[key] === 'object') {
        latestState = { ...latestState, ...event[key] as StateData };
      }
    });
  });

  // If there are messages, extract state from the last AI message
  const lastAIMessage = [...messages].reverse().find(msg => 
    typeof msg === 'object' && msg !== null && 'type' in msg && msg.type === 'ai'
  );
  if (lastAIMessage && typeof lastAIMessage === 'object' && 'content' in lastAIMessage) {
    // Try to parse potential state information
    // State extraction logic can be extended here as needed
  }

  // 1. Process Planning information
  result.planning = extractPlanningInfo(events, latestState);
  
  // 2. Build task details
  result.tasks = buildTaskDetails(events, latestState);
  
  // 3. Determine current task and overall status
  result.currentTaskId = getCurrentTaskId(events, latestState);
  result.overallStatus = determineOverallStatus(events);

  return result;
}

/**
 * Extract Planning information
 */
function extractPlanningInfo(events: EventData[], state: StateData): PlanningInfo | null {
  // Find planning-related events
  const planningEvent = events.find(event => 
    event.planner || event.planner_node || event.planning
  );
  
  if (!planningEvent && !state.plan) {
    return null;
  }

  const plan = state.plan || [];
  const currentPointer = state.current_task_pointer || 0;

  return {
    totalTasks: plan.length,
    currentTaskIndex: currentPointer,
    tasks: plan.map((task: TaskData) => ({
      id: task.id || 'unknown',
      description: task.description || 'Unknown task',
      status: task.status || 'pending'
    }))
  };
}

/**
 * Build task details
 */
function buildTaskDetails(events: EventData[], state: StateData): TaskDetail[] {
  const plan = state.plan || [];
  const currentPointer = state.current_task_pointer || 0;

  console.log(`🏗️ Building task details: Total tasks ${plan.length}, Current pointer ${currentPointer}`);

  return plan.map((task: TaskData, index: number) => {
    const taskId = task.id;
    console.log(`📋 Processing task ${index}: ${taskId} - ${task.description}`);
    
    // Determine task status
    let taskStatus: 'pending' | 'in_progress' | 'completed' = 'pending';
    if (index < currentPointer) {
      taskStatus = 'completed';
    } else if (index === currentPointer) {
      taskStatus = 'in_progress';
    }

    // Build task steps - For all tasks, not just the current one
    const shouldShowSteps = index <= currentPointer;
    console.log(`📋 Task ${index} status: ${taskStatus}, Show steps: ${shouldShowSteps}`);
    const steps = buildTaskSteps(events, state, taskId, shouldShowSteps);
    console.log(`📋 Task ${index} built ${steps.length} steps`);

    return {
      taskId,
      description: task.description || 'Unknown task',
      status: taskStatus,
      steps
    };
  });
}

/**
 * Build task steps - Improved version that supports showing historical steps for all tasks
 */
function buildTaskSteps(
  events: EventData[], 
  state: StateData, 
  taskId: string, 
  shouldShowSteps: boolean // Current task or completed tasks show steps
): TaskStep[] {
  const steps: TaskStep[] = [];

  console.log(`🔧 Building task steps for ${taskId}, Show steps: ${shouldShowSteps}`);
  console.log(`📊 Total events: ${events.length}`);

  // If it's the current task or a completed task, build steps based on events
  if (shouldShowSteps) {
    // 1. Query Generation
    const queryEvents = events.filter(event => event.generate_query);
    console.log(`🔍 Query events: ${queryEvents.length}`);
    if (queryEvents.length > 0) {
      const lastQueryEvent = queryEvents[queryEvents.length - 1];
      const queryData = lastQueryEvent.generate_query as { query_list?: string[] };
      steps.push({
        type: 'query_generation',
        title: 'Generating Search Queries',
        status: 'completed',
        data: lastQueryEvent.generate_query as EventData,
        details: [{
          type: 'search_queries',
          content: queryData.query_list?.join(', ') || 'No queries',
          metadata: { 
            count: queryData.query_list?.length || 0,
            queries: queryData.query_list || []
          }
        }]
      });
    }

    // 2. Web Research - Improved version, shows more details
    const webResearchEvents = events.filter(event => event.web_research);
    console.log(`🔍 Web Research events: ${webResearchEvents.length}`);
    if (webResearchEvents.length > 0) {
      webResearchEvents.forEach((event) => {
        const researchData = event.web_research as { 
          sources_gathered?: SourceData[];
          executed_search_queries?: string[];
          search_query?: string;
          total_sources?: number;
        };
        
        // Get the actual query from executed_search_queries or search_query
        let searchQuery = 'Unknown Query';
        if (researchData.executed_search_queries && researchData.executed_search_queries.length > 0) {
          searchQuery = researchData.executed_search_queries[0];
        } else if (researchData.search_query) {
          searchQuery = researchData.search_query;
        }
        
        const sources = researchData.sources_gathered || [];
        
        // Extract actual information from sources, following the actual structure returned by the backend
        const processedSources = sources.map((source: SourceData & { label?: string; short_url?: string; value?: string }) => {
          // Backend returns sources structure: {label, short_url, value, title?, snippet?}
          return {
            title: source.title || source.label || 'Source',
            url: source.value || source.short_url || source.url || '',
            label: source.label || 'Web',
            snippet: source.snippet || 'No preview available'
          };
        });
        
        steps.push({
          type: 'web_research',
          title: `Web Research: ${searchQuery}`,
          status: 'completed',
          data: event.web_research as EventData,
          details: [
            {
              type: 'search_queries',
              content: `Query: "${searchQuery}"`,
              metadata: { query: searchQuery }
            },
            {
              type: 'sources',
              content: `Found ${sources.length} relevant sources`,
              metadata: { 
                count: sources.length,
                sources: processedSources,
                totalFound: sources.length
              }
            }
          ]
        });
      });
    }

    // 3. Reflection
    const reflectionEvents = events.filter(event => event.reflection);
    console.log(`🔍 Reflection events: ${reflectionEvents.length}`);
    if (reflectionEvents.length > 0) {
      const lastReflection = reflectionEvents[reflectionEvents.length - 1];
      console.log(`🤔 Reflection data:`, lastReflection.reflection);
      const reflectionData = lastReflection.reflection as {
        reflection_is_sufficient?: boolean;
        reflection_knowledge_gap?: string;
        reflection_follow_up_queries?: string[];
      };
      
      const details = [];
      
      // Main analysis result
      details.push({
        type: 'analysis' as const,
        content: reflectionData.reflection_is_sufficient 
          ? '✅ Research quality meets requirements - sufficient information gathered'
          : '⚠️ Additional research needed - quality requirements not met',
        metadata: {
          is_sufficient: reflectionData.reflection_is_sufficient,
          status: reflectionData.reflection_is_sufficient ? 'sufficient' : 'insufficient'
        }
      });
      
      // Knowledge gap analysis
      if (reflectionData.reflection_knowledge_gap) {
        details.push({
          type: 'analysis' as const,
          content: `Knowledge Gap Identified: ${reflectionData.reflection_knowledge_gap}`,
          metadata: {
            knowledge_gap: reflectionData.reflection_knowledge_gap,
            gap_type: 'content_depth'
          }
        });
      }
      
      // Follow-up queries
      if (reflectionData.reflection_follow_up_queries && reflectionData.reflection_follow_up_queries.length > 0) {
        details.push({
          type: 'decision' as const,
          content: `Recommended follow-up research areas: ${reflectionData.reflection_follow_up_queries.length} queries identified`,
          metadata: {
            follow_up_queries: reflectionData.reflection_follow_up_queries,
            action_needed: !reflectionData.reflection_is_sufficient
          }
        });
      }
      
      console.log(`🤔 Added Reflection step, details count: ${details.length}`);
      steps.push({
        type: 'reflection',
        title: 'Reflection Analysis',
        status: 'completed',
        data: lastReflection.reflection as EventData,
        details: details
      });
    }

    // 4. Content Enhancement
    const enhancementEvents = events.filter(event => event.content_enhancement);
    console.log(`🔍 Content Enhancement events: ${enhancementEvents.length}`);
    if (enhancementEvents.length > 0) {
      const lastEnhancement = enhancementEvents[enhancementEvents.length - 1];
      console.log(`🔧 Content Enhancement data:`, lastEnhancement.content_enhancement);
      const enhancementData = lastEnhancement.content_enhancement as {
        enhancement_status?: string;
        enhancement_decision?: string;
        enhancement_reasoning?: string;
      };
      const status = enhancementData.enhancement_status;
      
      const details = [];
      
      // Enhancement decision
      details.push({
        type: 'decision' as const,
        content: getEnhancementStatusMessage(status || 'unknown'),
        metadata: { 
          status,
          decision: enhancementData.enhancement_decision,
          automated: true
        }
      });
      
      // Enhancement reasoning if exists
      if (enhancementData.enhancement_reasoning) {
        details.push({
          type: 'analysis' as const,
          content: `Reasoning: ${enhancementData.enhancement_reasoning}`,
          metadata: {
            reasoning_type: 'content_quality',
            reasoning: enhancementData.enhancement_reasoning
          }
        });
      }
      
      console.log(`🔧 Added Content Enhancement step, status: ${status}, details count: ${details.length}`);
      steps.push({
        type: 'content_enhancement',
        title: 'Content Enhancement Analysis',
        status: status === 'skipped' ? 'skipped' : 'completed',
        data: lastEnhancement.content_enhancement as EventData,
        details: details
      });
    }

    // 5. Research Evaluation
    const evaluationEvents = events.filter(event => event.evaluate_research_enhanced);
    console.log(`🔍 Research Evaluation events: ${evaluationEvents.length}`);
    if (evaluationEvents.length > 0) {
      const lastEvaluation = evaluationEvents[evaluationEvents.length - 1];
      console.log(`📊 Research Evaluation data:`, lastEvaluation.evaluate_research_enhanced);
      const evaluationData = lastEvaluation.evaluate_research_enhanced as {
        evaluation_is_sufficient?: boolean;
        evaluation_reasoning?: string;
        quality_score?: number;
      };
      
      const details = [];
      
      // Main evaluation result
      details.push({
        type: 'analysis' as const,
        content: evaluationData.evaluation_is_sufficient
          ? '✅ Research meets quality standards - ready for report generation'
          : '❌ Research quality insufficient - additional work required',
        metadata: {
          is_sufficient: evaluationData.evaluation_is_sufficient,
          evaluation_type: 'quality_assessment',
          quality_score: evaluationData.quality_score
        }
      });
      
      // Evaluation reasoning information
      if (evaluationData.evaluation_reasoning) {
        details.push({
          type: 'analysis' as const,
          content: `Quality Assessment: ${evaluationData.evaluation_reasoning}`,
          metadata: {
            reasoning: evaluationData.evaluation_reasoning,
            assessment_type: 'automated'
          }
        });
      }
      
      console.log(`📊 Added Research Evaluation step, is sufficient: ${evaluationData.evaluation_is_sufficient}, details count: ${details.length}`);
      steps.push({
        type: 'evaluation',
        title: 'Research Quality Evaluation',
        status: 'completed',
        data: lastEvaluation.evaluate_research_enhanced as EventData,
        details: details
      });
    }

    // 6. Task Completion
    const completionEvents = events.filter(event => event.record_task_completion);
    if (completionEvents.length > 0) {
      steps.push({
        type: 'completion',
        title: 'Task Completion Recorded',
        status: 'completed',
        data: completionEvents[completionEvents.length - 1].record_task_completion as EventData
      });
    }
  }

  return steps;
}

/**
 * Get current task ID
 */
function getCurrentTaskId(events: EventData[], state: StateData): string | null {
  const plan = state.plan || [];
  const currentPointer = state.current_task_pointer || 0;
  
  if (plan[currentPointer]) {
    return plan[currentPointer].id;
  }
  
  return null;
}

/**
 * Determine overall status
 */
function determineOverallStatus(events: EventData[]): 'planning' | 'researching' | 'completed' {
  // Check if there are finalize_answer events
  const finalizeEvents = events.filter(event => event.finalize_answer);
  if (finalizeEvents.length > 0) {
    return 'completed';
  }

  // Check if there are planning events
  const planningEvents = events.filter(event => event.planner || event.planner_node);
  if (planningEvents.length > 0) {
    return 'researching';
  }

  return 'planning';
}

/**
 * Get enhancement status message
 */
function getEnhancementStatusMessage(status: string): string {
  const statusMessages: Record<string, string> = {
    "skipped": "Content enhancement skipped - quality sufficient",
    "completed": "Content enhancement completed successfully", 
    "failed": "Content enhancement failed",
    "error": "Content enhancement encountered errors",
    "analyzing": "Analyzing content enhancement needs",
    "skipped_no_api": "Content enhancement skipped - no API key"
  };
  
  return statusMessages[status] || `Status: ${status}`;
}

/**
 * Debug function: Print transformation result
 */
export function debugTransformResult(data: ProcessedResearchData): void {
  console.log('🔍 Transformation result analysis:', {
    planning: data.planning,
    tasksCount: data.tasks.length,
    currentTaskId: data.currentTaskId,
    overallStatus: data.overallStatus,
    tasks: data.tasks.map(task => ({
      id: task.taskId,
      description: task.description,
      status: task.status,
      stepsCount: task.steps.length
    }))
  });
} 