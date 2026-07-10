jest.mock("../../src/models", () => {
  return {
    Usuario: {
      findByPk: jest.fn(),
      findAll: jest.fn(),
      build: jest.fn(),
      sequelize: {
        transaction: jest.fn((cb) => cb({})),
        fn: jest.fn(),
        col: jest.fn(),
        literal: jest.fn(),
      },
    },
    HistorialPunto: {
      create: jest.fn(),
    },
    KickUserTracking: {
      findOne: jest.fn(),
    },
    DiscordUserLink: {
      findOne: jest.fn(),
    },
    Rol: {
      findAll: jest.fn(),
      findByPk: jest.fn(),
    },
    Permiso: {
      findAll: jest.fn(),
      findOne: jest.fn(),
    },
    RolPermiso: {
      findAll: jest.fn(),
      count: jest.fn(),
    },
    sequelize: {
      literal: jest.fn(),
    },
    Op: { or: Symbol("or"), iLike: Symbol("iLike") },
  };
});

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("../../src/utils/kickApi", () => ({
  extractAvatarUrl: jest.fn(),
  getKickUserData: jest.fn(),
}));

const {
  Usuario,
  HistorialPunto,
  DiscordUserLink,
  Rol,
  Permiso,
  RolPermiso,
} = require("../../src/models");
const {
  getKickUserData,
  extractAvatarUrl,
} = require("../../src/utils/kickApi");
const usuariosCtrl = require("../../src/controllers/usuarios.controller");
const AppError = require("../../src/utils/AppError");

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status: jest.fn(function (c) {
      this.statusCode = c;
      return this;
    }),
    json: jest.fn(function (b) {
      this.body = b;
      return this;
    }),
  };
}

describe("usuarios.controller migration characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------- updateMe ----------
  describe("updateMe", () => {
    test("validation error -> next(AppError) 400 with err.message", async () => {
      const req = {
        user: {
          update: jest.fn().mockRejectedValue(new Error("Invalid field")),
        },
        body: { discord_username: "newname" },
      };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.updateMe(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Invalid field");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("success -> 200 { message, updated_fields }", async () => {
      const req = {
        user: {
          update: jest.fn().mockResolvedValue(undefined),
        },
        body: { discord_username: "newname" },
      };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.updateMe(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        message: "Profile updated",
        updated_fields: ["discord_username"],
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- listarUsuarios ----------
  describe("listarUsuarios", () => {
    test("DB error -> next(AppError) 500 Internal server error", async () => {
      Usuario.findAll.mockRejectedValue(new Error("DB down"));
      const req = { query: {} };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.listarUsuarios(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("Internal server error");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("success -> 200 with enriched users array", async () => {
      Usuario.findAll.mockResolvedValue([
        {
          toJSON: () => ({
            id: 1,
            nickname: "user1",
            puntos: 100,
            rol_id: 1,
            user_id_ext: null,
            is_vip: false,
            vip_granted_at: null,
            vip_expires_at: null,
            vip_granted_by_canje_id: null,
            botrix_migrated: false,
            botrix_migrated_at: null,
            botrix_points_migrated: 0,
            kick_data: null,
            creado: "2024-01-01",
            actualizado: "2024-01-01",
          }),
        },
      ]);
      Usuario.build.mockReturnValue({
        nickname: "user1",
        isVipActive: () => false,
        canMigrateBotrix: () => false,
        getUserType: () => "normal",
      });
      DiscordUserLink.findOne.mockResolvedValue(null);
      const req = { query: {} };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.listarUsuarios(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(1);
      expect(res.body[0].display_name).toBe("user1");
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- debugUsuario ----------
  describe("debugUsuario", () => {
    test("user not found -> next(AppError) 404", async () => {
      Usuario.findByPk.mockResolvedValue(null);
      const req = { params: { usuarioId: "999" } };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.debugUsuario(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("User not found");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("DB error -> next(AppError) 500 with error.message", async () => {
      Usuario.findByPk.mockRejectedValue(new Error("DB connection lost"));
      const req = { params: { usuarioId: "1" } };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.debugUsuario(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("DB connection lost");
    });

    test("success -> 200 with debug info", async () => {
      Usuario.findByPk.mockResolvedValue({
        id: 1,
        nickname: "testuser",
        rol_id: 2,
        user_id_ext: null,
        is_vip: false,
        vip_granted_at: null,
        vip_expires_at: null,
        vip_granted_by_canje_id: null,
        botrix_migrated: false,
        botrix_migrated_at: null,
        botrix_points_migrated: 0,
        creado: "2024-01-01",
        actualizado: "2024-01-01",
        toJSON: () => ({
          id: 1,
          nickname: "testuser",
          rol_id: 2,
          user_id_ext: null,
          is_vip: false,
          vip_granted_at: null,
          vip_expires_at: null,
          vip_granted_by_canje_id: null,
          botrix_migrated: false,
          botrix_migrated_at: null,
          botrix_points_migrated: 0,
          creado: "2024-01-01",
          actualizado: "2024-01-01",
        }),
        Rol: {
          id: 2,
          nombre: "moderator",
          descripcion: "Moderator role",
          RolPermisos: [
            {
              Permiso: {
                id: 1,
                nombre: "ver_historial_puntos",
                descripcion: "Can view points history",
              },
            },
          ],
        },
      });
      Usuario.build.mockReturnValue({
        isVipActive: () => false,
        canMigrateBotrix: () => false,
        getUserType: () => "normal",
      });
      const req = { params: { usuarioId: "1" } };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.debugUsuario(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.usuario.id).toBe(1);
      expect(res.body.rol.nombre).toBe("moderator");
      expect(res.body.permisos).toEqual(["ver_historial_puntos"]);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- debugRolesPermisos (line-806 version) ----------
  describe("debugRolesPermisos", () => {
    test("DB error -> next(AppError) 500 with error.message", async () => {
      Rol.findAll.mockRejectedValue(new Error("DB error"));
      const req = {};
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.debugRolesPermisos(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("DB error");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("success -> 200 with roles and permissions structure", async () => {
      Rol.findAll.mockResolvedValue([
        {
          id: 1,
          nombre: "user",
          descripcion: "Basic user",
          Permisos: [
            { id: 1, nombre: "canjear_productos", descripcion: "Can redeem" },
          ],
        },
      ]);
      Permiso.findAll.mockResolvedValue([
        { id: 1, nombre: "canjear_productos", descripcion: "Can redeem" },
      ]);
      RolPermiso.findAll.mockResolvedValue([
        { rol_id: 1, permiso_id: 1, Rol: { id: 1, nombre: "user" } },
      ]);
      Usuario.findAll.mockResolvedValue([{ rol_id: 1, getDataValue: () => 5 }]);
      Permiso.findOne.mockResolvedValue({
        id: 1,
        nombre: "ver_historial_puntos",
        RolPermisos: [{ Rol: { id: 2, nombre: "mod" } }],
      });
      const req = {};
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.debugRolesPermisos(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.debug_estructura.total_roles).toBe(1);
      expect(res.body.debug_estructura.total_permisos).toBe(1);
      expect(res.body.debug_estructura.total_relaciones).toBe(1);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- hotfixActualizarRol ----------
  describe("hotfixActualizarRol", () => {
    test("user not found -> next(AppError) 404", async () => {
      Usuario.findByPk.mockResolvedValue(null);
      const req = { params: { usuarioId: "999", nuevoRolId: "3" } };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.hotfixActualizarRol(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("User not found");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("DB error -> next(AppError) 500 with error.message", async () => {
      Usuario.findByPk.mockRejectedValue(new Error("DB failure"));
      const req = { params: { usuarioId: "1", nuevoRolId: "3" } };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.hotfixActualizarRol(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("DB failure");
    });

    test("success -> 200 { success, mensaje, usuario, timestamp }", async () => {
      Usuario.findByPk.mockResolvedValue({
        id: 1,
        nickname: "testuser",
        rol_id: 1,
        update: jest.fn().mockResolvedValue(undefined),
      });
      const req = { params: { usuarioId: "1", nuevoRolId: "3" } };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.hotfixActualizarRol(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.mensaje).toBe("Role updated for testuser");
      expect(res.body.usuario.rol_anterior).toBe(1);
      expect(res.body.usuario.rol_nuevo).toBe(3);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- syncKickInfo ----------
  describe("syncKickInfo", () => {
    test("no Kick connection -> next(AppError) 400 with details", async () => {
      Usuario.findByPk.mockResolvedValue({
        id: 1,
        nickname: "testuser",
        user_id_ext: null,
      });
      const req = { user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.syncKickInfo(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("User not connected to Kick");
      expect(err.details).toBe("You must connect your Kick account first");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("user not found at all -> next(AppError) 400 with details", async () => {
      Usuario.findByPk.mockResolvedValue(null);
      const req = { user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.syncKickInfo(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("User not connected to Kick");
    });

    test("Kick fetch error -> next(AppError) 500 with details", async () => {
      Usuario.findByPk.mockResolvedValue({
        id: 1,
        nickname: "testuser",
        user_id_ext: "kick-123",
        kick_data: {},
      });
      getKickUserData.mockRejectedValue(new Error("Kick API timeout"));
      const req = { user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.syncKickInfo(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("Could not fetch updated Kick data");
      expect(err.details).toBe("Kick API timeout");
    });

    test("user not found on Kick -> next(AppError) 404 with details", async () => {
      Usuario.findByPk.mockResolvedValue({
        id: 1,
        nickname: "testuser",
        user_id_ext: "kick-123",
        kick_data: {},
      });
      getKickUserData.mockResolvedValue(null);
      const req = { user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.syncKickInfo(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("User not found on Kick");
      expect(err.details).toBe(
        "The user may have been deleted or is not public"
      );
    });

    test("general error -> next(AppError) 500 with details", async () => {
      Usuario.findByPk.mockRejectedValue(new Error("DB connection lost"));
      const req = { user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.syncKickInfo(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("Error syncing info");
      expect(err.details).toBe("DB connection lost");
    });

    test("success -> 200 { message, user, changes }", async () => {
      const mockUser = {
        id: 1,
        nickname: "oldname",
        user_id_ext: "kick-123",
        kick_data: { avatar_url: "old.jpg", username: "oldname" },
        update: jest.fn().mockResolvedValue(undefined),
      };
      Usuario.findByPk.mockResolvedValueOnce(mockUser).mockResolvedValueOnce({
        id: 1,
        nickname: "kickuser",
        puntos: 500,
        rol_id: 1,
        kick_data: {
          avatar_url: "new.jpg",
          username: "kickuser",
          user_id: "kick-123",
          last_sync: "2024-01-01T00:00:00.000Z",
        },
        creado: "2024-01-01",
        actualizado: "2024-01-02",
      });
      getKickUserData.mockResolvedValue({
        name: "kickuser",
        user_id: "kick-123",
        profile_picture: { profile_picture: "new.jpg" },
      });
      extractAvatarUrl.mockReturnValue("new.jpg");
      const req = { user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.syncKickInfo(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("Info synced successfully");
      expect(res.body.user.id).toBe(1);
      expect(res.body.user.nickname).toBe("kickuser");
      expect(res.body.changes.avatar_updated).toBe(true);
      expect(res.body.changes.username_updated).toBe(true);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- debugPermisos ----------
  describe("debugPermisos", () => {
    test("user not found -> next(AppError) 404", async () => {
      Usuario.findByPk.mockResolvedValue(null);
      const req = { user: { id: 999 } };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.debugPermisos(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("User not found");
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test("DB error -> next(AppError) 500 with error.message", async () => {
      Usuario.findByPk.mockRejectedValue(new Error("DB failure"));
      const req = { user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.debugPermisos(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("DB failure");
    });

    test("success -> 200 with permissions info", async () => {
      Usuario.findByPk.mockResolvedValue({
        id: 1,
        nickname: "testuser",
        rol_id: 2,
        Rol: {
          nombre: "moderator",
          descripcion: "Moderator role",
          Permisos: [
            { id: 1, nombre: "ver_historial_puntos", descripcion: "Can view" },
            { id: 2, nombre: "canjear_productos", descripcion: "Can redeem" },
          ],
        },
      });
      const req = { user: { id: 1 } };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.debugPermisos(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.usuario.id).toBe(1);
      expect(res.body.usuario.rol_nombre).toBe("moderator");
      expect(res.body.permisos).toEqual([
        "ver_historial_puntos",
        "canjear_productos",
      ]);
      expect(res.body.verificaciones.puede_ver_historial_puntos).toBe(true);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- me (already migrated — verify unchanged) ----------
  describe("me", () => {
    test("unauthenticated -> next(AppError) 401", async () => {
      const req = { user: null };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.me(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe("User not authenticated");
    });

    test("success -> 200 with full user body", async () => {
      const mockUser = {
        id: 1,
        nickname: "testuser",
        puntos: 1000,
        rol_id: 2,
        kick_data: null,
        discord_username: null,
        is_vip: false,
        vip_granted_at: null,
        vip_expires_at: null,
        vip_granted_by_canje_id: null,
        botrix_migrated: false,
        botrix_migrated_at: null,
        botrix_points_migrated: 0,
        user_id_ext: null,
        creado: "2024-01-01",
        actualizado: "2024-01-02",
        isVipActive: () => false,
        canMigrateBotrix: () => false,
        getUserType: () => "normal",
      };
      DiscordUserLink.findOne.mockResolvedValue(null);
      const req = { user: mockUser };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.me(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(1);
      expect(res.body.nickname).toBe("testuser");
      expect(res.body.display_name).toBe("testuser");
      expect(res.body.puntos).toBe(1000);
      expect(res.body.rol_id).toBe(2);
      expect(res.body.discord_info).toBeNull();
      expect(res.body.vip_status.is_active).toBe(false);
      expect(res.body.migration_status.can_migrate).toBe(false);
      expect(res.body.user_type).toBe("normal");
      expect(res.body.subscriber_status.is_active).toBe(false);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- actualizarPuntos (already migrated — verify unchanged) ----------
  describe("actualizarPuntos", () => {
    test("invalid operation -> next(AppError) 400", async () => {
      const req = {
        params: { id: "1" },
        body: { puntos: 100, motivo: "test", operation: "invalid" },
        user: { nickname: "admin" },
      };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.actualizarPuntos(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Operation must be 'add' or 'set'");
    });

    test("user not found -> next(AppError) 404", async () => {
      Usuario.findByPk.mockResolvedValue(null);
      const req = {
        params: { id: "999" },
        body: { puntos: 100, motivo: "test", operation: "set" },
        user: { nickname: "admin" },
      };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.actualizarPuntos(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("User not found");
    });

    test("success -> 200 with transaction result", async () => {
      Usuario.findByPk.mockResolvedValue({
        id: 1,
        nickname: "testuser",
        puntos: 500,
        update: jest.fn().mockResolvedValue(undefined),
      });
      HistorialPunto.create.mockResolvedValue({});
      const req = {
        params: { id: "1" },
        body: { puntos: 1000, motivo: "bonus", operation: "set" },
        user: { nickname: "admin" },
      };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.actualizarPuntos(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        message: "Points updated successfully",
        usuario: {
          id: 1,
          nickname: "testuser",
          puntosAnteriores: 500,
          puntosNuevos: 1000,
          cambio: 500,
        },
        operation: "set",
        motivo: "bonus",
        administrador: "admin",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("success with 'add' operation -> 200 with correct cambio", async () => {
      Usuario.findByPk.mockResolvedValue({
        id: 1,
        nickname: "testuser",
        puntos: 500,
        update: jest.fn().mockResolvedValue(undefined),
      });
      HistorialPunto.create.mockResolvedValue({});
      const req = {
        params: { id: "1" },
        body: { puntos: 200, motivo: "reward", operation: "add" },
        user: { nickname: "admin" },
      };
      const res = createRes();
      const next = jest.fn();

      await usuariosCtrl.actualizarPuntos(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.usuario.puntosAnteriores).toBe(500);
      expect(res.body.usuario.puntosNuevos).toBe(700);
      expect(res.body.usuario.cambio).toBe(200);
      expect(res.body.operation).toBe("add");
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------- errorHandler integration: { error } shape ----------
  describe("errorHandler integration — { error } shape", () => {
    const express = require("express");
    const supertest = require("supertest");
    const {
      errorHandler,
    } = require("../../src/middleware/errorHandler.middleware");

    function buildApp() {
      const app = express();
      app.use(express.json());
      return app;
    }

    test("debugUsuario 404 -> { error: 'User not found' } via errorHandler", async () => {
      Usuario.findByPk.mockResolvedValue(null);
      const app = buildApp();
      app.get("/debug/:usuarioId", usuariosCtrl.debugUsuario);
      app.use(errorHandler);

      const response = await supertest(app).get("/debug/999");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "User not found");
      expect(response.body).not.toHaveProperty("success");
    });

    test("syncKickInfo 400 -> { error, details } via errorHandler", async () => {
      Usuario.findByPk.mockResolvedValue({
        id: 1,
        nickname: "testuser",
        user_id_ext: null,
      });
      const app = buildApp();
      app.get("/sync", (req, _res, next) => {
        req.user = { id: 1 };
        next();
      });
      app.get("/sync", usuariosCtrl.syncKickInfo);
      app.use(errorHandler);

      const response = await supertest(app).get("/sync");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        "error",
        "User not connected to Kick"
      );
      expect(response.body).toHaveProperty(
        "details",
        "You must connect your Kick account first"
      );
      expect(response.body).not.toHaveProperty("success");
    });

    test("debugRolesPermisos 500 -> { error } via errorHandler (no success key)", async () => {
      Rol.findAll.mockRejectedValue(new Error("DB down"));
      const app = buildApp();
      app.get("/debug-roles", usuariosCtrl.debugRolesPermisos);
      app.use(errorHandler);

      const response = await supertest(app).get("/debug-roles");

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error", "DB down");
      expect(response.body).not.toHaveProperty("success");
    });

    test("hotfixActualizarRol 404 -> { error } via errorHandler (no success key)", async () => {
      Usuario.findByPk.mockResolvedValue(null);
      const app = buildApp();
      app.post(
        "/hotfix/:usuarioId/:nuevoRolId",
        usuariosCtrl.hotfixActualizarRol
      );
      app.use(errorHandler);

      const response = await supertest(app).post("/hotfix/999/3");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "User not found");
      expect(response.body).not.toHaveProperty("success");
    });
  });
});
