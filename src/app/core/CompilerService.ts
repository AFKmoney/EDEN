import { Injectable, inject } from '@angular/core';
import { CoreEngine } from './CoreEngine';

@Injectable({ providedIn: 'root' })
export class CompilerService {
  private engine = inject(CoreEngine);

  compile(): string {
    const genome = this.engine.genome();
    const nodes = Object.values(genome.nodes);

    // Sort nodes by type to ensure Data -> Logic -> UI order conceptually
    const dataNodes = nodes.filter(n => n.type === 'Data');
    const logicNodes = nodes.filter(n => n.type === 'Logic');
    const uiNodes = nodes.filter(n => n.type === 'UI');

    const dataCode = dataNodes.map(n => `// --- Data: ${n.metadata.title || n.id} ---\n${n.metadata.content || ''}`).join('\n\n');
    const logicCode = logicNodes.map(n => `// --- Logic: ${n.metadata.title || n.id} ---\n${n.metadata.content || ''}`).join('\n\n');
    const uiCode = uiNodes.map(n => `<!-- UI: ${n.metadata.title || n.id} -->\n${n.metadata.content || ''}`).join('\n\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EDEN Generated App</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { 
      background-color: #0f172a; 
      color: #f8fafc; 
      font-family: system-ui, -apple-system, sans-serif; 
      min-height: 100vh;
      margin: 0;
      padding: 2rem;
    }
    /* Default nice styles for generated UI */
    button { cursor: pointer; }
  </style>
</head>
<body>
  <div id="eden-root" class="max-w-4xl mx-auto flex flex-col gap-6">
    ${uiCode || '<div class="text-gray-500 italic text-center mt-10">No UI nodes defined. Create a UI Cell and add HTML to see it here.</div>'}
  </div>

  <script>
    // --- EDEN GENERATED STATE ---
    ${dataCode}

    // --- EDEN GENERATED LOGIC ---
    ${logicCode}
  </script>
</body>
</html>`;
  }
}
