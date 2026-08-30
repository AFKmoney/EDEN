import { Injectable, inject, signal } from '@angular/core';
import { CoreEngine } from './CoreEngine';
import { VfsService } from './VfsService';
import { TerminalService } from './TerminalService';
import { CliService } from './CliService';

export type AiMode = 'eden' | 'raw' | 'plan' | 'yolo';

export interface AgentMemory {
  objective: string;
  iterations: number;
  completedActions: string[];
  failedActions: string[];
  currentPlan: string[];
  contextSummary: string;
  timestamp: number;
}

export interface AgentPlan {
  steps: string[];
  currentStepIndex: number;
  completedSteps: boolean[];
}

/**
 * EdenAiPipelineService — Centralized AI pipeline for EDEN.
 * 
 * Handles single-shot and agentic-loop (autonomous) executions.
 */
@Injectable({ providedIn: 'root' })
export class EdenAiPipelineService {
  private engine = inject(CoreEngine);
  private vfs = inject(VfsService);
  private terminal = inject(TerminalService);
  private cli = inject(CliService);

  /** Current AI execution mode. YOLO by default. */
  public mode = signal<AiMode>('yolo');

  /** Whether a standard AI execution is in progress */
  public isExecuting = signal<boolean>(false);

  // --- AGENTIC LOOP STATE ---
  public isAgenticLoopActive = signal<boolean>(false);
  public currentObjective = signal<string>('');
  public agenticIteration = signal<number>(0);
  public maxAgenticIterations = signal<number>(20);
  public currentReasoning = signal<string>('');
  
  // Agent Memory & Planning
  public agentMemory = signal<AgentMemory>({
    objective: '',
    iterations: 0,
    completedActions: [],
    failedActions: [],
    currentPlan: [],
    contextSummary: '',
    timestamp: Date.now()
  });
  
  public agentPlan = signal<AgentPlan>({
    steps: [],
    currentStepIndex: 0,
    completedSteps: []
  });
  
  private abortRequested = false;

  /**
   * Build the full EDEN context string for AI CLI prompts.
   */
  buildEdenContext(): string {
    const genome = this.engine.genome();
    const nodeCount = Object.keys(genome.nodes).length;
    const edgeCount = Object.keys(genome.edges).length;
    const vmRunning = this.engine.isVmRunning();
    const files = this.vfs.listFiles();

    const nodesCompact = Object.values(genome.nodes).map(n => ({
      id: n.id,
      type: (n as any).type,
      title: (n as any).metadata.title,
      ternary: (n as any).ternaryState,
      gate: (n as any).metadata.gateType,
      pos: (n as any).position
    }));

    const edgesCompact = Object.values(genome.edges).map(e => ({
      src: (e as any).sourceId,
      tgt: (e as any).targetId
    }));

    const filesCompact = files.map(f => ({
      path: f.path,
      size: f.content.length,
      content: f.content.length > 500 ? f.content.substring(0, 500) + '...[TRUNCATED]' : f.content
    }));

    return `You are an EDEN architecture AI with FULL CONTROL of the EDEN graph IDE.
Current state: ${nodeCount} nodes, ${edgeCount} edges, VM ${vmRunning ? 'RUNNING' : 'STOPPED'}, ${files.length} files in VFS.

Graph nodes: ${JSON.stringify(nodesCompact)}
Graph edges: ${JSON.stringify(edgesCompact)}
VFS files: ${JSON.stringify(filesCompact)}

You MUST respond ONLY with a JSON block enclosed in \`\`\`json ... \`\`\`. No other text.
Format strictly as:
\`\`\`json
{
  "nodes": [
    { "id": "unique_string", "type": "UI" | "Logic" | "Data", "position": {"x": number, "y": number}, "metadata": {"title": "string", "content": "string", "gateType": "AND" | "OR" | "NOT"} }
  ],
  "edges": [
    { "sourceId": "id1", "targetId": "id2" }
  ],
  "files": [
    { "path": "/src/example.ts", "content": "string content here" }
  ],
  "reasoning": "Brief explanation of your current action and logic."
}
\`\`\`
If the user is just asking a question, respond normally in text (no JSON block).
`;
  }

  /**
   * Build the Evaluation context for the Agentic Loop.
   */
  buildAgenticContext(objective: string, previousError?: string): string {
    const baseContext = this.buildEdenContext();
    let errorContext = '';

    if (previousError) {
      errorContext = `\n[ANTI-BAD BEHAVIOUR FRAMEWORK WARNING]:
The previous iteration failed with the following error:
"${previousError}"
You MUST correct this error in your next response. Ensure your JSON format is strictly valid and matches the requested structure.`;
    }

    return `${baseContext}
AGENCY OBJECTIVE (EVALUATION PHASE): 
You are inside an autonomous evaluator loop. Your ultimate goal is: "${objective}".${errorContext}

Evaluate the CURRENT STATE of the graph and VFS against this objective. 
- Have you fully achieved the objective?
- If YES: You MUST respond ONLY with \`\`\`json { "completed": true, "reasoning": "Final confirmation that all steps are done." } \`\`\`.
- If NO: Identify what is missing or incorrect, and output the NEXT JSON mutation (nodes, edges, files) to get closer to the objective. Include your "reasoning" for this specific mutation. Do NOT output "completed": true if there is still work to do.

User request: Evaluate state and proceed.`;
  }

  /**
   * Build enhanced agentic context with memory and planning capabilities
   */
  buildEnhancedAgenticContext(objective: string, previousError?: string, contextSummary?: string): string {
    const baseContext = this.buildEdenContext();
    const memory = this.agentMemory();
    let errorContext = '';

    if (previousError) {
      errorContext = `\n[ANTI-BAD BEHAVIOUR FRAMEWORK WARNING]:\nThe previous iteration failed with the following error:\n"${previousError}"\nYou MUST correct this error in your next response. Ensure your JSON format is strictly valid and matches the requested structure.`;
    }

    const memoryContext = `\n[AGENT MEMORY]:\n` +
      `Objective: ${memory.objective}\n` +
      `Iterations: ${memory.iterations}\n` +
      `Completed: ${memory.completedActions.length} actions\n` +
      `Failed: ${memory.failedActions.length} actions\n` +
      `Last action: ${memory.completedActions.slice(-1)[0] || 'None'}\n` +
      (contextSummary ? `Context: ${contextSummary}\n` : '');

    return `${baseContext}\nAGENCY OBJECTIVE (EVALUATION PHASE): \nYou are inside an autonomous evaluator loop. Your ultimate goal is: "${objective}".${errorContext}${memoryContext}\n\nEvaluate the CURRENT STATE of the graph and VFS against this objective. \n- Have you fully achieved the objective?\n- If YES: You MUST respond ONLY with \`\`\`json { "completed": true, "reasoning": "Final confirmation that all steps are done." } \`\`\`.\n- If NO: Identify what is missing or incorrect, and output the NEXT JSON mutation (nodes, edges, files) to get closer to the objective. Include your "reasoning" for this specific mutation. Do NOT output "completed": true if there is still work to do.\n\nUser request: Evaluate state and proceed.`;
  }

  // --- AGENTIC LOOP EXECUTION ---
  
  abortAgenticLoop() {
    if (this.isAgenticLoopActive()) {
      this.abortRequested = true;
      this.terminal.log('[AGENT] Stop requested by user. Aborting loop...', 'WARN');
    }
  }

  /**
   * Update agent memory with current state
   */
  private updateAgentMemory(action: string, success: boolean, error?: string) {
    this.agentMemory.update(memory => {
      const newMemory = { ...memory };
      newMemory.iterations = this.agenticIteration();
      
      if (success) {
        newMemory.completedActions = [...memory.completedActions, action];
      } else {
        newMemory.failedActions = [...memory.failedActions, `${action}: ${error}`];
      }
      
      newMemory.timestamp = Date.now();
      return newMemory;
    });
  }

  /**
   * Generate a context summary for the AI
   */
  private generateContextSummary(): string {
    const genome = this.engine.genome();
    const nodeCount = Object.keys(genome.nodes).length;
    const edgeCount = Object.keys(genome.edges).length;
    const files = this.vfs.listFiles();
    
    const memory = this.agentMemory();
    const completed = memory.completedActions.length;
    const failed = memory.failedActions.length;
    
    return `Current State: ${nodeCount} nodes, ${edgeCount} edges, ${files.length} files. 
Agent Progress: ${completed} completed, ${failed} failed. 
Last action: ${memory.completedActions.slice(-1)[0] || 'None'}`;
  }

  async executeAgenticLoop(engineName: 'local' | 'gemini', objective: string, maxIterations = 5) {
    if (this.isAgenticLoopActive() || this.isExecuting()) return;

    this.isAgenticLoopActive.set(true);
    this.currentObjective.set(objective);
    this.maxAgenticIterations.set(maxIterations);
    this.abortRequested = false;
    this.terminal.log(`[AGENT] Starting autonomous evaluation loop with ${engineName.toUpperCase()} for objective: "${objective}"`, 'SYSTEM');

    let iteration = 0;
    let previousError = '';

    try {
      // Initialize memory for this agentic loop
      this.agentMemory.set({
        objective,
        iterations: 0,
        completedActions: [],
        failedActions: [],
        currentPlan: [],
        contextSummary: this.generateContextSummary(),
        timestamp: Date.now()
      });

      while (iteration < maxIterations && !this.abortRequested) {
        iteration++;
        this.agenticIteration.set(iteration);
        this.terminal.log(`[AGENT] Iteration ${iteration}/${maxIterations} - Analyzing state...`, 'INFO');

        // Build enhanced context with memory
        const contextSummary = this.generateContextSummary();
        const prompt = this.buildEnhancedAgenticContext(objective, previousError, contextSummary);
        previousError = ''; // reset after using

        // Force YOLO mode strictly for agentic evaluation inner loops to prevent interaction blocks
        const res = await this.cli.execute(engineName, prompt, 'yolo');

        if (this.abortRequested) break;

        if (res.error) {
          this.terminal.log(`[AGENT] Error: ${res.error}. Aborting loop.`, 'ERROR');
          this.updateAgentMemory(`Iteration ${iteration}: API Error`, false, res.error);
          break;
        }

        const out = res.stdout || '';

        // Check if completed
        const isCompletedMatch = out.match(/"completed"\s*:\s*true/);
        
        if (isCompletedMatch) {
          this.terminal.log(`[AGENT] Evaluation result: COMPLETED. Objective achieved!`, 'SYSTEM');
          this.updateAgentMemory(`Objective completed: ${objective}`, true);
          break;
        } else {
          this.terminal.log(`[AGENT] Evaluation result: INCOMPLETE. Mutating state...`, 'INFO');
          // Parse and inject
          try {
            const injected = this.tryInjectFromOutput(out);
            if (injected) {
              this.updateAgentMemory(`Iteration ${iteration}: Mutations applied`, true);
            } else if (iteration === 1) {
              // If first iteration didn't inject anything and didn't complete, it might have responded in text
              this.terminal.log(`[AGENT] AI output did not contain valid mutations. Evaluating again next cycle.`, 'WARN');
              previousError = "ERROR: Failed to inject mutations. Ensure you are outputting the exact requested JSON format with 'nodes', 'edges', or 'files'.";
              this.updateAgentMemory(`Iteration ${iteration}: No valid mutations`, false, previousError);
            } else {
              previousError = "ERROR: Output lacked valid JSON mutations. Please correct format.";
              this.updateAgentMemory(`Iteration ${iteration}: Invalid format`, false, previousError);
            }
          } catch (e: any) {
            this.terminal.log(`[AGENT] Injection failed: ${e.message}`, 'WARN');
            previousError = `ERROR: Invalid JSON or mutation structure. ${e.message}`;
            this.updateAgentMemory(`Iteration ${iteration}: Injection error`, false, e.message);
          }
          
          // Wait briefly to allow UI to visually update
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (iteration >= maxIterations && !this.abortRequested) {
        this.terminal.log(`[AGENT] Max iterations (${maxIterations}) reached. Halting autonomous loop.`, 'WARN');
      }
    } catch (e: any) {
      this.terminal.log(`[AGENT] Fatal error: ${e.message}`, 'ERROR');
    } finally {
      this.isAgenticLoopActive.set(false);
      this.currentObjective.set('');
      this.agenticIteration.set(0);
      this.currentReasoning.set('');
      this.abortRequested = false;
    }
  }

  // --- STANDARD EXECUTION ---

  async execute(engineName: 'local' | 'gemini', userPrompt: string): Promise<{ stdout: string; stderr: string; error: string }> {
    this.isExecuting.set(true);
    this.terminal.log(`[EDEN Pipeline] Starting ${engineName} in ${this.mode()} mode...`, 'SYSTEM');

    const result = { stdout: '', stderr: '', error: '' };

    try {
      const mode = this.mode();
      let finalArgs = userPrompt;

      if (mode === 'eden' || mode === 'yolo') {
        if (!userPrompt.startsWith('-')) {
          finalArgs = this.buildEdenContext() + "User request: " + userPrompt;
        }
      }

      const res = await this.cli.execute(engineName, finalArgs, mode);

      if (res.stdout) {
        result.stdout = res.stdout;
        this.terminal.log(result.stdout, 'INFO');
        if (mode !== 'raw') {
          this.tryInjectFromOutput(res.stdout);
        }
      }
      if (res.stderr) {
        result.stderr = res.stderr;
        this.terminal.log(res.stderr, 'WARN');
      }
      if (res.error) {
        result.error = res.error;
        this.terminal.log(res.error, 'ERROR');
      }
    } catch (error: unknown) {
      const err = error as Error;
      result.error = err.message || 'Unknown error';
      this.terminal.log(result.error, 'ERROR');
    } finally {
      this.isExecuting.set(false);
    }

    return result;
  }

  async executeRaw(engineName: 'local' | 'gemini', args: string): Promise<{ stdout: string; stderr: string; error: string }> {
    this.isExecuting.set(true);
    this.terminal.log(`[CLI Raw] ${engineName} ${args}`, 'SYSTEM');

    const result = { stdout: '', stderr: '', error: '' };

    try {
      const res = await this.cli.execute(engineName, args, 'raw');
      result.stdout = res.stdout || '';
      result.stderr = res.stderr || '';
      result.error = res.error || '';
      if (result.stdout) this.terminal.log(result.stdout, 'INFO');
      if (result.stderr) this.terminal.log(result.stderr, 'WARN');
      if (result.error) this.terminal.log(result.error, 'ERROR');
    } catch (error: unknown) {
      const err = error as Error;
      result.error = err.message || 'Unknown error';
      this.terminal.log(result.error, 'ERROR');
    } finally {
      this.isExecuting.set(false);
    }

    return result;
  }

  tryInjectFromOutput(output: string): boolean {
    try {
      const jsonMatch = output.match(/```(?:json)?\n([\s\S]*?)\n```/) || output.match(/\{([\s\S]*)\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : output;

      const startIndex = jsonStr.indexOf('{');
      const endIndex = jsonStr.lastIndexOf('}');

      if (startIndex === -1 || endIndex === -1) {
        throw new Error("Could not find valid JSON block boundaries in response.");
      }

      const cleanJson = jsonStr.substring(startIndex, endIndex + 1);
      const parsed = JSON.parse(cleanJson) as { 
        nodes?: any[], 
        edges?: any[], 
        files?: any[], 
        reasoning?: string,
        completed?: boolean 
      };

      if (!parsed) {
        throw new Error("Parsed JSON was null or undefined.");
      }

      if (parsed.reasoning) {
        this.currentReasoning.set(parsed.reasoning);
        this.terminal.log(`[AGENT] Reasoning: ${parsed.reasoning}`, 'INFO');
      }

      let injectedNodes = 0;
      let injectedEdges = 0;
      let injectedFiles = 0;

      if (parsed.nodes && Array.isArray(parsed.nodes)) {
        const nodesToInject: Record<string, any> = {};
        const edgesToInject: Record<string, any> = {};

        const baseX = Math.floor(Math.random() * 300) + 100;
        const baseY = Math.floor(Math.random() * 300) + 100;

        parsed.nodes.forEach((n: any, index: number) => {
          const id = n.id || 'node_ai_' + Math.random().toString(36).substr(2, 9);
          nodesToInject[id] = {
            id,
            type: (n as any).type || 'Data',
            position: {
              x: baseX + ((n as any).position?.x || index * 300),
              y: baseY + ((n as any).position?.y || index * 100)
            },
            metadata: (n as any).metadata || { title: 'AI Node', content: '' },
            ternaryState: 'UNKNOWN'
          };
          injectedNodes++;
        });

        parsed.edges?.forEach((e: any) => {
          const edgeId = 'edge_' + (e as any).sourceId + '_' + (e as any).targetId;
          edgesToInject[edgeId] = {
            id: edgeId,
            sourceId: (e as any).sourceId,
            targetId: (e as any).targetId
          };
          injectedEdges++;
        });

        this.engine.mutate({ nodes: nodesToInject, edges: edgesToInject });
      }

      if (parsed.files && Array.isArray(parsed.files)) {
        parsed.files.forEach((f: any) => {
          if (f.path && f.content !== undefined) {
            this.vfs.writeFile(f.path, f.content);
            injectedFiles++;
          }
        });
      }

      if (injectedNodes > 0 || injectedEdges > 0 || injectedFiles > 0) {
        this.terminal.log(
          `[EDEN Pipeline] Injected ${injectedNodes} nodes, ${injectedEdges} edges, ${injectedFiles} files.`,
          'SYSTEM'
        );
        return true;
      }

      return false;
    } catch (e) {
      return false;
    }
  }

  createFallbackNode(engineName: string, output: string) {
    const id = 'node_cli_' + Math.random().toString(36).substr(2, 9);
    const x = Math.floor(Math.random() * 800) + 150;
    const y = Math.floor(Math.random() * 500) + 150;

    this.engine.mutate({
      nodes: {
        [id]: {
          id,
          type: 'Data',
          position: { x, y },
          metadata: {
            title: engineName.toUpperCase() + ' Output',
            content: output.substring(0, 500) + (output.length > 500 ? '...' : '')
          },
          ternaryState: 'UNKNOWN'
        }
      },
      edges: {}
    });
    this.terminal.log('CLI output injected as fallback node.', 'SYSTEM');
  }
}
