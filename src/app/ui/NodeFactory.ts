import { Type } from '@angular/core';
import { NodeType } from '../types/node';
import { UiNode } from './nodes/ui-node';
import { LogicNode } from './nodes/logic-node';
import { DataNode } from './nodes/data-node';

export class NodeFactory {
  static getComponent(type: NodeType): Type<any> {
    switch (type) {
      case 'UI':
        return UiNode;
      case 'Logic':
        return LogicNode;
      case 'Data':
        return DataNode;
      default:
        return LogicNode;
    }
  }
}
