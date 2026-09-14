import { Module } from "@nestjs/common";
import { InternalHttpModule } from "../http/internal-http.module";
import { FichasDelUsuarioService } from "./fichas-del-usuario.service";

@Module({
  imports: [InternalHttpModule],
  providers: [FichasDelUsuarioService],
  exports: [FichasDelUsuarioService],
})
/** Cablea el resolutor de las fichas de cliente de un usuario. */
export class FichasDelUsuarioModule {}
