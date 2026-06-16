import { 
  Injectable, 
  NestInterceptor, 
  ExecutionContext, 
  CallHandler,
  Logger
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Repository, FindOptionsWhere, EntityTarget } from 'typeorm';
import { TenantEntity } from '@beautyspot/database';

@Injectable()
export class TenantQueryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantQueryInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const businessId = request.headers["x-business-id"] as string;
    
    if (!businessId) {
      return next.handle();
    }

    this.logger.debug(`Aplicando filtrado automático de tenant: ${businessId}`);
    
    const repositories = this.getRepositoriesFromRequest(request);
    
    for (const repo of repositories) {
      this.patchRepository(repo, businessId);
    }
    
    return next.handle();
  }

  private patchRepository(repo: Repository<any>, businessId: string): void {
    if (!this.isTenantEntity(repo)) {
      return;
    }

    const originalFind = repo.find.bind(repo);
    const originalFindOne = repo.findOne.bind(repo);
    const originalFindOneBy = repo.findOneBy.bind(repo);
    const originalCount = repo.count.bind(repo);
    const originalQueryBuilder = repo.createQueryBuilder.bind(repo);

    repo.find = async (options?: any) => {
      options = options || {};
      options.where = options.where || {};
      
      if (this.shouldInjectBusinessId(options.where)) {
        options.where.businessId = businessId;
      }
      
      return originalFind(options);
    };

    repo.findOne = async (options?: any) => {
      if (options?.where) {
        if (typeof options.where === 'string') {
          options.where = { id: options.where };
        }
        
        if (this.shouldInjectBusinessId(options.where)) {
          options.where.businessId = businessId;
        }
      }
      
      return originalFindOne(options);
    };

    repo.findOneBy = async (where: FindOptionsWhere<any>) => {
      if (this.shouldInjectBusinessId(where)) {
        return originalFindOneBy({ ...where, businessId });
      }
      
      return originalFindOneBy(where);
    };

    repo.count = async (options?: any) => {
      options = options || {};
      options.where = options.where || {};
      
      if (this.shouldInjectBusinessId(options.where)) {
        options.where.businessId = businessId;
      }
      
      return originalCount(options);
    };

    repo.createQueryBuilder = (alias?: string) => {
      const qb = originalQueryBuilder(alias);
      
      if (!this.isTenantEntity(repo)) return qb;
      
      qb.andWhere(`${alias}.businessId = :businessId`, { businessId });
      
      return qb;
    };
  }

  private isTenantEntity(repo: Repository<any>): boolean {
    if (!repo || !repo.target) {
      return false;
    }
    
    try {
      const entity = repo.target as Function;
      return entity instanceof TenantEntity;
    } catch {
      return false;
    }
  }

  private shouldInjectBusinessId(where: any): boolean {
    if (!where) return true;
    
    if (typeof where === 'string') {
      return true;
    }
    
    if (where.id && typeof where === 'object' && Object.keys(where).length === 1) {
      return false;
    }
    
    return true;
  }

  private getRepositoriesFromRequest(request: any): Repository<any>[] {
    const repositories: Repository<any>[] = [];
    
    if (request.service && typeof request.service === 'object') {
      const service = request.service;
      
      for (const key in service) {
        const value = (service as any)[key];
        
        if (this.isRepository(value)) {
          repositories.push(value);
        }
      }
    }
    
    return repositories;
  }

  private isRepository(value: any): boolean {
    return value && 
           typeof value === 'object' && 
           value.constructor && 
           value.constructor.name === 'Repository';
  }
}