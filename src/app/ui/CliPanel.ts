import { Component } from '@angular/core';
import { ChatPanel } from './ChatPanel';

/**
 * Backward compatibility alias: CliPanel now mounts the advanced ChatPanel
 */
@Component({
  selector: 'eden-cli-panel',
  standalone: true,
  imports: [ChatPanel],
  template: `<eden-chat-panel />`
})
export class CliPanel {}

export { ChatPanel };
