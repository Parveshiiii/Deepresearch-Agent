import React from 'react';
import { ProcessedResearchData, TaskDetail, TaskStep } from '@/utils/dataTransformer';
import { ChevronDown, ChevronRight, CheckCircle2, Clock, AlertCircle, Play, Pause } from 'lucide-react';

interface ResearchThinkPanelProps {
  researchData: ProcessedResearchData | null;
  isLoading: boolean;
}

export const ResearchThinkPanel: React.FC<ResearchThinkPanelProps> = ({
  researchData,
  isLoading
}) => {
  const [expandedTasks, setExpandedTasks] = React.useState<Set<string>>(new Set());
  const [expandedSteps, setExpandedSteps] = React.useState<Set<string>>(new Set());

  // Automatically expand current task and all steps when research data changes
  React.useEffect(() => {
    if (researchData) {
      console.log("🎯 Think Panel: Auto-expand logic triggered", {
        currentTaskId: researchData.currentTaskId,
        overallStatus: researchData.overallStatus,
        tasksCount: researchData.tasks.length
      });

      // Auto-expand current task and all tasks with steps
      const tasksWithSteps = researchData.tasks.filter(t => t.steps.length > 0);
      console.log("🎯 Think Panel: Tasks with steps:", tasksWithSteps.map(t => ({ id: t.taskId, stepsCount: t.steps.length })));
      
      if (tasksWithSteps.length > 0) {
        const taskIdsToExpand = tasksWithSteps.map(t => t.taskId);
        setExpandedTasks(new Set(taskIdsToExpand));
        
        // Auto-expand all steps for these tasks
        const stepKeysToExpand = tasksWithSteps.flatMap(task => 
          task.steps.map((_, index) => `${task.taskId}-${index}`)
        );
        setExpandedSteps(new Set(stepKeysToExpand));
        
        console.log("🎯 Think Panel: Auto-expanded", {
          expandedTasks: taskIdsToExpand,
          expandedSteps: stepKeysToExpand.length
        });
      }
      
      // If research is completed, expand all tasks and steps to show full process
      if (researchData.overallStatus === 'completed') {
        const allTaskIds = researchData.tasks.map(t => t.taskId);
        setExpandedTasks(new Set(allTaskIds));
        
        const allStepKeys = researchData.tasks.flatMap(task => 
          task.steps.map((_, index) => `${task.taskId}-${index}`)
        );
        setExpandedSteps(new Set(allStepKeys));
        
        console.log("🎯 Think Panel: Research completed, expanding all", {
          allTasks: allTaskIds.length,
          allSteps: allStepKeys.length
        });
      }
    }
  }, [researchData?.currentTaskId, researchData?.overallStatus, researchData?.tasks?.length]);

  const toggleTaskExpansion = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const toggleStepExpansion = (stepKey: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepKey)) {
      newExpanded.delete(stepKey);
    } else {
      newExpanded.add(stepKey);
    }
    setExpandedSteps(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'in_progress':
        return <Play className="h-4 w-4 text-blue-400" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      case 'skipped':
        return <Pause className="h-4 w-4 text-gray-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-red-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-900/20';
      case 'in_progress':
        return 'text-blue-400 bg-blue-900/20';
      case 'pending':
        return 'text-yellow-400 bg-yellow-900/20';
      case 'skipped':
        return 'text-gray-400 bg-gray-900/20';
      default:
        return 'text-red-400 bg-red-900/20';
    }
  };

  if (!researchData) {
    return (
      <div className="bg-neutral-900 rounded-lg p-6 h-full">
        <div className="flex items-center justify-center h-full text-neutral-400">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Waiting for research to start...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 rounded-lg h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-neutral-800 p-6">
        <h2 className="text-xl font-semibold text-white mb-2">Research Think Panel</h2>
        <div className="flex items-center gap-4 text-sm text-neutral-400">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(researchData.overallStatus)}`}>
            {researchData.overallStatus === 'planning' && 'Planning'}
            {researchData.overallStatus === 'researching' && 'Researching'}
            {researchData.overallStatus === 'completed' && 'Completed'}
          </span>
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-3 w-3 border border-blue-400 border-t-transparent rounded-full"></div>
              <span className="text-blue-400">Running...</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Planning Section */}
        {researchData.planning && (
          <div className="border-b border-neutral-800 p-6">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <div className="h-2 w-2 bg-purple-400 rounded-full"></div>
              Research Planning Strategy
            </h3>
            <div className="bg-neutral-800 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">{researchData.planning.totalTasks}</div>
                  <div className="text-sm text-neutral-400">Total Tasks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{researchData.planning.currentTaskIndex + 1}</div>
                  <div className="text-sm text-neutral-400">Current Task</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {researchData.planning.tasks.filter(t => t.status === 'completed').length}
                  </div>
                  <div className="text-sm text-neutral-400">Completed</div>
                </div>
              </div>
              
              <div className="space-y-2">
                {researchData.planning.tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      index === researchData.planning!.currentTaskIndex
                        ? 'bg-blue-900/30 border border-blue-800'
                        : 'bg-neutral-700/50'
                    }`}
                  >
                    <div className="text-sm font-mono text-neutral-400 w-8">
                      #{index + 1}
                    </div>
                    {getStatusIcon(task.status)}
                    <div className="flex-1 text-sm text-white">{task.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tasks Section */}
        <div className="p-6">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <div className="h-2 w-2 bg-green-400 rounded-full"></div>
            Task Execution Details
          </h3>
          
          {researchData.tasks.length === 0 ? (
            <div className="text-center py-8 text-neutral-400">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No task details available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {researchData.tasks.map((task) => (
                <TaskCard
                  key={task.taskId}
                  task={task}
                  isExpanded={expandedTasks.has(task.taskId)}
                  onToggleExpansion={() => toggleTaskExpansion(task.taskId)}
                  expandedSteps={expandedSteps}
                  onToggleStepExpansion={toggleStepExpansion}
                  getStatusIcon={getStatusIcon}
                  getStatusColor={getStatusColor}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface TaskCardProps {
  task: TaskDetail;
  isExpanded: boolean;
  onToggleExpansion: () => void;
  expandedSteps: Set<string>;
  onToggleStepExpansion: (stepKey: string) => void;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusColor: (status: string) => string;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isExpanded,
  onToggleExpansion,
  expandedSteps,
  onToggleStepExpansion,
  getStatusIcon,
  getStatusColor
}) => {
  console.log(`📋 TaskCard render: ${task.taskId}`, {
    stepsCount: task.steps.length,
    isExpanded,
    steps: task.steps.map(s => ({ type: s.type, title: s.title, hasDetails: !!(s.details && s.details.length > 0) }))
  });

  return (
    <div className="bg-neutral-800 rounded-lg border border-neutral-700">
      {/* Task Header */}
      <div
        className="p-4 cursor-pointer hover:bg-neutral-750 transition-colors"
        onClick={onToggleExpansion}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-neutral-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          )}
          {getStatusIcon(task.status)}
          <div className="flex-1">
            <div className="font-medium text-white">{task.description}</div>
            <div className="text-sm text-neutral-400 mt-1">
              {task.steps.length} execution steps
            </div>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
            {task.status === 'pending' && 'Pending'}
            {task.status === 'in_progress' && 'In Progress'}  
            {task.status === 'completed' && 'Completed'}
          </span>
        </div>
      </div>

      {/* Task Steps */}
      {isExpanded && (
        <div className="border-t border-neutral-700 p-4 space-y-3">
          {task.steps.length === 0 ? (
            <div className="text-center py-4 text-neutral-500 text-sm">
              No execution steps available
            </div>
          ) : (
            task.steps.map((step, stepIndex) => (
              <StepCard
                key={`${task.taskId}-${stepIndex}`}
                step={step}
                stepKey={`${task.taskId}-${stepIndex}`}
                isExpanded={expandedSteps.has(`${task.taskId}-${stepIndex}`)}
                onToggleExpansion={() => onToggleStepExpansion(`${task.taskId}-${stepIndex}`)}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

interface StepCardProps {
  step: TaskStep;
  stepKey: string;
  isExpanded: boolean;
  onToggleExpansion: () => void;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusColor: (status: string) => string;
}

const StepCard: React.FC<StepCardProps> = ({
  step,
  isExpanded,
  onToggleExpansion,
  getStatusIcon,
  getStatusColor
}) => {
  const hasDetails = step.details && step.details.length > 0;
  const [showAllSources, setShowAllSources] = React.useState(false);

  return (
    <div className="bg-neutral-700/50 rounded-lg border border-neutral-600">
      {/* Step Header */}
      <div
        className={`p-3 ${hasDetails ? 'cursor-pointer hover:bg-neutral-600/50' : ''} transition-colors`}
        onClick={hasDetails ? onToggleExpansion : undefined}
      >
        <div className="flex items-center gap-3">
          {hasDetails && (
            isExpanded ? (
              <ChevronDown className="h-3 w-3 text-neutral-400" />
            ) : (
              <ChevronRight className="h-3 w-3 text-neutral-400" />
            )
          )}
          {getStatusIcon(step.status)}
          <div className="flex-1">
            <div className="font-medium text-white text-sm">{step.title}</div>
            <div className="text-xs text-neutral-400 mt-1">
              {step.type === 'query_generation' && 'Query Generation'}
              {step.type === 'web_research' && 'Web Research'}
              {step.type === 'reflection' && 'Reflection Analysis'}
              {step.type === 'content_enhancement' && 'Content Enhancement'}
              {step.type === 'evaluation' && 'Quality Evaluation'}
              {step.type === 'completion' && 'Task Completion'}
            </div>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(step.status)}`}>
            {step.status === 'pending' && 'Pending'}
            {step.status === 'in_progress' && 'Running'}  
            {step.status === 'completed' && 'Done'}
            {step.status === 'skipped' && 'Skipped'}
          </span>
        </div>
      </div>

      {/* Step Details */}
      {isExpanded && step.details && (
        <div className="border-t border-neutral-600 p-3 space-y-2">
          {step.details.map((detail, detailIndex) => (
            <div key={detailIndex} className="bg-neutral-800/50 rounded p-3">
              <div className="text-xs font-medium text-neutral-300 mb-2 uppercase tracking-wide">
                {detail.type === 'search_queries' && 'Search Queries'}
                {detail.type === 'sources' && 'Data Sources'}
                {detail.type === 'analysis' && 'Analysis Results'}
                {detail.type === 'decision' && 'Decision Info'}
              </div>
              <div className="text-sm text-white mb-2">{detail.content}</div>
              
              {detail.metadata && (
                <div className="space-y-2">
                  {detail.metadata.count !== undefined && (
                    <div className="text-xs text-neutral-400">
                      Count: {detail.metadata.count}
                    </div>
                  )}
                  
                  {detail.metadata.sources && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-neutral-300">Source Details:</div>
                      {(showAllSources ? detail.metadata.sources : detail.metadata.sources.slice(0, 3)).map((source, sourceIndex) => (
                        <div key={sourceIndex} className="text-xs text-neutral-400 bg-neutral-800 rounded p-2">
                          <div className="font-medium text-neutral-300">{source.title}</div>
                          <div className="text-xs text-blue-400 mt-1">
                            <span className="bg-blue-900/30 px-1 py-0.5 rounded text-xs mr-2">{source.label}</span>
                          </div>
                          {source.url && (
                            <div className="text-blue-400 break-all mt-1 text-xs">{source.url}</div>
                          )}
                          {source.snippet && (
                            <div className="mt-1 text-neutral-400 text-xs">{source.snippet}</div>
                          )}
                        </div>
                      ))}
                      
                      {detail.metadata.sources.length > 3 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAllSources(!showAllSources);
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors border border-blue-400/30 hover:border-blue-300/50 rounded px-2 py-1 mt-2"
                        >
                          {showAllSources 
                            ? `Show less sources` 
                            : `Show all ${detail.metadata.sources.length} sources`
                          }
                        </button>
                      )}
                    </div>
                  )}
                  
                  {detail.metadata.follow_up_queries && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-neutral-300">Follow-up Queries:</div>
                      <div className="text-xs text-neutral-400">
                        {detail.metadata.follow_up_queries.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 