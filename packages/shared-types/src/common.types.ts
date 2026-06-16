export interface IAddress {
  address: string;
  city: string;
  state: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

export interface IGeoLocation {
  latitude: number;
  longitude: number;
}

export interface IAuditFields {
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface IPaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "ASC" | "DESC";
  search?: string;
}

export interface IPaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface IApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface IApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  statusCode: number;
}

export enum BusinessType {
  BARBERIA = "BARBERIA",
  SALON_BELLEZA = "SALON_BELLEZA",
  SPA = "SPA",
  CENTRO_ESTETICO = "CENTRO_ESTETICO",
  UNISEX = "UNISEX",
}
