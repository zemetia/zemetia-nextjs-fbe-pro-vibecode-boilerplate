export type SalesOrderStatusDTO = 'DRAFT' | 'CONFIRMED' | 'IN_PRODUCTION' | 'DELIVERED' | 'VOID';
export type SalesDeliveryStatusDTO = 'DRAFT' | 'CONFIRMED' | 'VOID';

export interface SalesOrderDTO {
  id: string;
  number: string;
  date: string;
  status: SalesOrderStatusDTO;
  partner_id: string;
  payment_type?: string;
}

export interface SalesDeliveryDTO {
  id: string;
  order_id: string;
  number: string;
  date: string;
  status: SalesDeliveryStatusDTO;
}

export interface SalesOrderProgressDTO {
  order_id: string;
  percentage: number;
  delivered_weight_gram?: number;
}

export interface SalesOrderDetailDTO extends SalesOrderDTO {
  items: unknown[];
  deliveries: unknown[];
  progress?: SalesOrderProgressDTO;
}
