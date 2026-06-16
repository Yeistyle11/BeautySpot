import { IAuditFields } from "./common.types";

export interface IService extends IAuditFields {
  id: string;
  businessId: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  image?: string;
  active: boolean;
}

export interface ICreateService {
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  image?: string;
}

export interface IUpdateService extends Partial<ICreateService> {
  active?: boolean;
}
