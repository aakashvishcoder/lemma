export interface CRDTChar {
  id: string;  
  siteId: string;
  counter: number;
  position: string;  
  value: string;
  deleted: boolean;
}

export interface InsertOp {
  type: 'insert';
  char: CRDTChar;
}

export interface DeleteOp {
  type: 'delete';
  id: string;
}

export type CRDTOp = InsertOp | DeleteOp;