export interface EdenEdge {
  id: string;
  sourceId: string;
  targetId: string;
  transform?: (data: any) => any;
}
