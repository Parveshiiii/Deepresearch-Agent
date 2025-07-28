import { useStream } from "@langchain/langgraph-sdk/react";
import type { Message } from "@langchain/langgraph-sdk";
import { useState, useEffect, useRef, useCallback } from "react";
import { ProcessedEvent } from "@/components/ActivityTimeline";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { ChatMessagesView } from "@/components/ChatMessagesView";
import { transformEventsToHierarchy, debugTransformResult, EventData } from "@/utils/dataTransformer";

// Add type definitions
interface StreamEvent {
  [key: string]: unknown;
}

interface SourceData {
  title?: string;
  url?: string; 
  label?: string;
  snippet?: string;
}

export default function App() {
  const [processedEventsTimeline, setProcessedEventsTimeline] = useState<
    ProcessedEvent[]
  >([]);
  const [historicalActivities, setHistoricalActivities] = useState<
    Record<string, ProcessedEvent[]>
  >({});
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const hasFinalizeEventOccurredRef = useRef(false);

  const thread = useStream<{
    messages: Message[];
    initial_search_query_count: number;
    max_research_loops: number;
    reasoning_model: string;
  }>({
    apiUrl: import.meta.env.DEV
      ? "http://localhost:2024"
      : "http://localhost:8123",
    assistantId: "agent",
    messagesKey: "messages",
    onFinish: (state) => {
      console.log(state);
    },
    onUpdateEvent: (event: StreamEvent) => {
      // 🐛 DEBUG: Complete event log
      console.log("📨 Received event:", event);
      console.log("📊 Event structure analysis:", {
        eventKeys: Object.keys(event),
        eventType: typeof event,
        hasGenerateQuery: !!event.generate_query,
        hasWebResearch: !!event.web_research,
        hasReflection: !!event.reflection,
        hasPlanner: !!(event.planner_node || event.planner),
        hasContentEnhancement: !!event.content_enhancement_analysis,
        hasEvaluateResearch: !!event.evaluate_research_enhanced,
        hasFinalizeAnswer: !!event.finalize_answer,
        hasRecordTaskCompletion: !!event.record_task_completion,
        allEventKeys: Object.keys(event).join(", ")
      });
      
      // 🔧 NEW: Collect events for transformer testing - using static collection instead of state
      const allEvents = JSON.parse(sessionStorage.getItem('research_events') || '[]') as EventData[];
      allEvents.push(event as EventData);
      sessionStorage.setItem('research_events', JSON.stringify(allEvents));
      
      // Test transformer every 5 events (avoid being too frequent)
      if (allEvents.length % 5 === 0) {
        try {
          const transformedData = transformEventsToHierarchy(allEvents, thread.messages || []);
          console.log("🔍 Data transformer test results:");
          debugTransformResult(transformedData);
        } catch (error) {
          console.warn("⚠️ Data transformer test failed:", error);
        }
      }
      
      let processedEvent: ProcessedEvent | null = null;
      let eventProcessed = false;
      if (event.generate_query) {
        const queryData = event.generate_query as { query_list?: string[] };
        processedEvent = {
          title: "Generating Search Queries",
          data: queryData.query_list?.join(", ") || "No queries",
        };
        eventProcessed = true;
      } else if (event.web_research) {
        // 🐛 DEBUG: Log detailed web_research event structure
        console.log("🔍 Web Research Event Details:", event.web_research);
        
        const researchData = event.web_research as { sources_gathered?: SourceData[] };
        const sources = researchData.sources_gathered || [];
        const numSources = sources.length;
        
        // 🐛 DEBUG: Log source structure
        if (sources.length > 0) {
          console.log("📊 First source structure:", sources[0]);
          console.log("📊 All source keys:", sources.map(s => Object.keys(s)));
        }
        
        const uniqueLabels = [
          ...new Set(sources.map((s: SourceData) => s.label).filter(Boolean)),
        ];
        const exampleLabels = uniqueLabels.slice(0, 3).join(", ");
        processedEvent = {
          title: "Web Research",
          data: `Gathered ${numSources} sources. Related to: ${
            exampleLabels || "N/A"
          }.`,
        };
        eventProcessed = true;
      } else if (event.reflection) {
        // 🐛 DEBUG: Log detailed reflection event structure
        console.log("🤔 Reflection Event Details:", event.reflection);
        
        const reflectionData = event.reflection as {
          reflection_is_sufficient?: boolean;
          reflection_follow_up_queries?: string[];
        };
        processedEvent = {
          title: "Reflection",
          data: reflectionData.reflection_is_sufficient
            ? "Search successful, generating final answer."
            : `Need more information, searching for ${(reflectionData.reflection_follow_up_queries || []).join(
                ", "
              )}`,
        };
        eventProcessed = true;
      } else if (event.planner_node || event.planner) {
        const plannerData = (event.planner_node || event.planner) as { plan?: unknown[] };
        processedEvent = {
          title: "Planning Research Strategy",
          data: plannerData.plan 
            ? `Generated ${plannerData.plan.length} research tasks`
            : "Analyzing research requirements...",
        };
        eventProcessed = true;
      } else if (event.content_enhancement_analysis) {
        const enhancementData = event.content_enhancement_analysis as {
          needs_enhancement?: boolean;
          reasoning?: string;
        };
        processedEvent = {
          title: "Content Enhancement Analysis",
          data: enhancementData.needs_enhancement
            ? `Enhancement needed: ${enhancementData.reasoning || 'Analyzing content quality'}`
            : "Content quality sufficient, proceeding with report generation",
        };
        eventProcessed = true;
      } else if (event.evaluate_research_enhanced) {
        const evaluationData = event.evaluate_research_enhanced as {
          evaluation_is_sufficient?: boolean;
        };
        processedEvent = {
          title: "Research Quality Evaluation",
          data: evaluationData.evaluation_is_sufficient
            ? "Research meets quality standards"
            : "Additional research required",
        };
        eventProcessed = true;
      } else if (event.content_enhancement) {
        // 🐛 DEBUG: Log detailed content enhancement event structure
        console.log("🔧 Content Enhancement Event Details:", event.content_enhancement);
        
        const enhancementData = event.content_enhancement as {
          enhancement_status?: string;
        };
        const enhancementStatus = enhancementData.enhancement_status || "unknown";
        const statusMessages: Record<string, string> = {
          "skipped": "Content enhancement skipped - quality sufficient",
          "completed": "Content enhancement completed successfully", 
          "failed": "Content enhancement failed",
          "error": "Content enhancement encountered errors",
          "analyzing": "Analyzing content enhancement needs",
          "skipped_no_api": "Content enhancement skipped - no API key"
        };
        processedEvent = {
          title: "Content Enhancement Analysis",
          data: statusMessages[enhancementStatus] || `Status: ${enhancementStatus}`,
        };
        eventProcessed = true;
      } else if (event.record_task_completion) {
        const completionData = event.record_task_completion as {
          next_node_decision?: string;
          ledger?: Array<{ description?: string }>;
        };
        const nextDecision = completionData.next_node_decision || "continue";
        const ledger = completionData.ledger || [];
        const completedTask = ledger.length > 0 ? ledger[0].description : "Unknown task";
        processedEvent = {
          title: "Task Completion Recorded",
          data: nextDecision === "end" 
            ? `All tasks completed. Final task: ${completedTask}`
            : `Task completed: ${completedTask}. Moving to next task.`,
        };
        eventProcessed = true;
      } else if (event.finalize_answer) {
        processedEvent = {
          title: "Finalizing Answer",
          data: "Composing and presenting the final answer.",
        };
        hasFinalizeEventOccurredRef.current = true;
        eventProcessed = true;
      }
      
      // 🐛 DEBUG: Check for unhandled event types
      if (!eventProcessed) {
        console.warn("⚠️ Unhandled event type:", {
          eventKeys: Object.keys(event),
          eventData: event,
          possibleMissingHandlers: [
            "record_task_completion",
            "content_enhancement", 
            "should_enhance_content",
            "decide_next_research_step",
            "decide_next_step_in_plan"
          ]
        });
      } else {
        console.log("✅ Event processed:", processedEvent?.title);
        
        // 🔧 NEW: Try to save snapshot after any key event is processed
        if (processedEvent?.title === "Reflection" || 
            processedEvent?.title === "Content Enhancement Analysis" ||
            processedEvent?.title === "Research Quality Evaluation") {
          console.log(`🎯 Detected key event, preparing to save snapshot: ${processedEvent.title}`);
          saveCurrentStateSnapshot(processedEvent.title);
        }
      }
      
      if (processedEvent) {
        console.log(`➕ Adding new event to timeline: ${processedEvent.title}`);
        setProcessedEventsTimeline((prevEvents) => {
          const newEvents = [...prevEvents, processedEvent!];
          console.log(`📋 Updated event timeline (${newEvents.length}):`, newEvents.map(e => e.title));
          return newEvents;
        });
      }
    },
  });

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [thread.messages]);

  useEffect(() => {
    if (
      hasFinalizeEventOccurredRef.current &&
      !thread.isLoading &&
      thread.messages.length > 0
    ) {
      const lastMessage = thread.messages[thread.messages.length - 1];
      if (lastMessage && lastMessage.type === "ai" && lastMessage.id) {
        setHistoricalActivities((prev) => ({
          ...prev,
          [lastMessage.id!]: [...processedEventsTimeline],
        }));
      }
      hasFinalizeEventOccurredRef.current = false;
    }
  }, [thread.messages, thread.isLoading, processedEventsTimeline]);

  const handleSubmit = useCallback(
    (submittedInputValue: string, effort: string, model: string) => {
      if (!submittedInputValue.trim()) return;
      setProcessedEventsTimeline([]);
      hasFinalizeEventOccurredRef.current = false;
      
      // Clear event storage
      sessionStorage.removeItem('research_events');

      // convert effort to, initial_search_query_count and max_research_loops
      // low means max 1 loop and 1 query
      // medium means max 3 loops and 3 queries
      // high means max 10 loops and 5 queries
      let initial_search_query_count = 0;
      let max_research_loops = 0;
      switch (effort) {
        case "low":
          initial_search_query_count = 1;
          max_research_loops = 1;
          break;
        case "medium":
          initial_search_query_count = 3;
          max_research_loops = 3;
          break;
        case "high":
          initial_search_query_count = 5;
          max_research_loops = 10;
          break;
      }

      const newMessages: Message[] = [
        ...(thread.messages || []),
        {
          type: "human",
          content: submittedInputValue,
          id: Date.now().toString(),
        },
      ];
      thread.submit({
        messages: newMessages,
        initial_search_query_count: initial_search_query_count,
        max_research_loops: max_research_loops,
        reasoning_model: model,
      });
    },
    [thread]
  );

  const handleCancel = useCallback(() => {
    thread.stop();
    window.location.reload();
  }, [thread]);

  // New: Function to save intermediate state snapshots
  const saveCurrentStateSnapshot = useCallback((stateName: string) => {
    console.log(`📸 Saving state snapshot: ${stateName}`);
    console.log(`📊 Current message count: ${thread.messages?.length || 0}`);
    console.log(`📊 Current timeline events: ${processedEventsTimeline.length}`);
    
    // Add delay to ensure AI message is created
    setTimeout(() => {
      console.log(`⏰ Checking messages after delay: ${thread.messages?.length || 0}`);
      if (thread.messages && thread.messages.length > 0) {
        const lastMessage = thread.messages[thread.messages.length - 1];
        console.log(`📋 Last message:`, { 
          id: lastMessage.id, 
          type: lastMessage.type, 
          contentLength: typeof lastMessage.content === 'string' ? lastMessage.content.length : 'non-string'
        });
        
        if (lastMessage && lastMessage.type === "ai" && lastMessage.id) {
          // Create a snapshot of the current timeline
          const snapshot = [...processedEventsTimeline];
          console.log(`📷 Saving snapshot for message ${lastMessage.id} (${snapshot.length} events):`, snapshot.map(e => e.title));
          
          setHistoricalActivities((prev) => {
            const newActivities = {
              ...prev,
              [lastMessage.id!]: snapshot,
            };
            console.log(`✅ Snapshot saved, total historical activities:`, Object.keys(newActivities).length);
            return newActivities;
          });
        } else {
          console.warn(`⚠️ Cannot save snapshot ${stateName}: Last message is not an AI message`);
        }
      } else {
        console.warn(`⚠️ Cannot save snapshot ${stateName}: No messages`);
      }
    }, 300); // Increased delay to 300ms
  }, [thread.messages, processedEventsTimeline]);

  return (
    <div className="flex h-screen bg-neutral-800 text-neutral-100 font-sans antialiased">
      <main className="flex-1 flex flex-col overflow-hidden w-full h-full">
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {thread.messages.length === 0 ? (
            <WelcomeScreen
              handleSubmit={handleSubmit}
              isLoading={thread.isLoading}
              onCancel={handleCancel}
            />
          ) : (
            <ChatMessagesView
              messages={thread.messages}
              isLoading={thread.isLoading}
              scrollAreaRef={scrollAreaRef}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              liveActivityEvents={processedEventsTimeline}
              historicalActivities={historicalActivities}
            />
          )}
        </div>
      </main>
    </div>
  );
}
