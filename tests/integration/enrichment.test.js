jest.mock("../../src/models", () => ({
  Canje: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  Producto: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  Usuario: {},
  HistorialPunto: {},
  KickUserTracking: { findOne: jest.fn() },
  DiscordUserLink: { findOne: jest.fn() },
  Promocion: {},
  PromocionProducto: {},
  sequelize: {
    literal: jest.fn(() => ({})),
  },
  Op: { iLike: Symbol("iLike"), in: Symbol("in") },
}));

jest.mock("../../src/services/vip.service", () => ({
  grantVipFromCanje: jest.fn(),
}));

jest.mock("../../src/services/kickBot.service", () => ({
  sendMessage: jest.fn(),
}));

jest.mock("../../src/services/promocion.service", () => ({
  calcularMejorDescuento: jest.fn(),
  obtenerPromocionesActivasProducto: jest.fn(),
  aplicarPromocion: jest.fn(),
}));

jest.mock("../../src/services/notificacion.service", () => ({
  crearNotificacionCanjeCreado: jest.fn(),
  crearNotificacionCanjeEntregado: jest.fn(),
  crearNotificacionCanjeCancelado: jest.fn(),
  crearNotificacionCanjeDevuelto: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { Canje, Producto, DiscordUserLink } = require("../../src/models");
const promocionService = require("../../src/services/promocion.service");
const canjesCtrl = require("../../src/controllers/canjes.controller");
const productosCtrl = require("../../src/controllers/productos.controller");

const FIXED_DESCUENTO = {
  precioFinal: 80,
  descuento: 20,
  porcentajeDescuento: "20",
  promocion: null,
};

const PROMO_SENTINEL = {
  id: "PROMO_ID_1",
  codigo: "PROMO_CODE_1",
  titulo: "PROMO_TITLE_1",
  descripcion: "PROMO_DESC_1",
  tipo_descuento: "PROMO_TYPE_1",
  valor_descuento: "PROMO_VALUE_1",
  fecha_fin: "PROMO_DATE_1",
  metadata_visual: "PROMO_META_1",
  requiere_codigo: "PROMO_REQ_1",
};

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
}

function makeCanjeWithUsuario() {
  return {
    id: 1,
    estado: "pendiente",
    usuario_id: 10,
    Usuario: {
      id: 10,
      nickname: "testuser",
      is_vip: false,
      vip_expires_at: null,
      user_id_ext: null,
      dataValues: {},
    },
    Producto: {
      id: 1,
      nombre: "Test Product",
    },
  };
}

function makeProductoInstance(overrides = {}) {
  const data = {
    id: 1,
    nombre: "Test Product",
    precio: 100,
    stock: 5,
    estado: "publicado",
    slug: "test-product",
    ...overrides,
  };
  return {
    ...data,
    toJSON: () => ({ ...data }),
  };
}

describe("enrichment characterization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    promocionService.calcularMejorDescuento.mockResolvedValue(FIXED_DESCUENTO);
    promocionService.obtenerPromocionesActivasProducto.mockResolvedValue([
      PROMO_SENTINEL,
    ]);
  });

  describe("canjes enrichment - includeDiscord split", () => {
    test("listar -> discord enrichment RAN", async () => {
      const canje = makeCanjeWithUsuario();
      Canje.findAll.mockResolvedValue([canje]);
      DiscordUserLink.findOne.mockResolvedValue({
        discord_user_id: "discord-123",
        discord_username: "discorduser",
        discord_discriminator: "4567",
        discord_avatar: "avatar.png",
        createdAt: new Date("2024-01-01T00:00:00Z"),
      });

      const req = { query: {}, params: {} };
      const res = createRes();
      const next = jest.fn();

      await canjesCtrl.listar(req, res, next);

      expect(res.statusCode).toBe(200);
      const user = res.body[0].Usuario;
      expect(user.dataValues.vip_status).toBeDefined();
      expect(user.dataValues.subscriber_status).toBeDefined();
      expect(user.dataValues.discord_info).toBeDefined();
      expect(user.dataValues.discord_info).not.toBeNull();
      expect(user.dataValues.display_name).toBeDefined();
      expect(DiscordUserLink.findOne).toHaveBeenCalled();
    });

    test("listarMios -> discord enrichment did NOT run", async () => {
      const canje = makeCanjeWithUsuario();
      Canje.findAll.mockResolvedValue([canje]);

      const req = { user: { id: 10 }, query: {}, params: {} };
      const res = createRes();
      const next = jest.fn();

      await canjesCtrl.listarMios(req, res, next);

      expect(res.statusCode).toBe(200);
      const user = res.body[0].Usuario;
      expect(user.dataValues.vip_status).toBeDefined();
      expect(user.dataValues.subscriber_status).toBeDefined();
      expect(user.dataValues).not.toHaveProperty("discord_info");
      expect(user.dataValues).not.toHaveProperty("display_name");
      expect(DiscordUserLink.findOne).not.toHaveBeenCalled();
    });

    test("listarPorUsuario -> discord enrichment RAN", async () => {
      const canje = makeCanjeWithUsuario();
      Canje.findAll.mockResolvedValue([canje]);
      DiscordUserLink.findOne.mockResolvedValue({
        discord_user_id: "discord-123",
        discord_username: "discorduser",
        discord_discriminator: "4567",
        discord_avatar: "avatar.png",
        createdAt: new Date("2024-01-01T00:00:00Z"),
      });

      const req = { params: { usuarioId: "10" }, query: {} };
      const res = createRes();
      const next = jest.fn();

      await canjesCtrl.listarPorUsuario(req, res, next);

      expect(res.statusCode).toBe(200);
      const user = res.body[0].Usuario;
      expect(user.dataValues.vip_status).toBeDefined();
      expect(user.dataValues.subscriber_status).toBeDefined();
      expect(user.dataValues.discord_info).toBeDefined();
      expect(user.dataValues.discord_info).not.toBeNull();
      expect(user.dataValues.display_name).toBeDefined();
      expect(DiscordUserLink.findOne).toHaveBeenCalled();
    });
  });

  describe("productos enrichment - short vs full promociones_activas", () => {
    test("listar -> short 5-field set", async () => {
      Producto.findAll.mockResolvedValue([makeProductoInstance()]);

      const req = { query: {}, params: {} };
      const res = createRes();
      const next = jest.fn();

      await productosCtrl.listar(req, res, next);

      expect(res.statusCode).toBe(200);
      const promo = res.body[0].promociones_activas[0];
      expect(promo).toEqual({
        id: "PROMO_ID_1",
        codigo: "PROMO_CODE_1",
        titulo: "PROMO_TITLE_1",
        tipo_descuento: "PROMO_TYPE_1",
        valor_descuento: "PROMO_VALUE_1",
      });
      expect(promo).not.toHaveProperty("descripcion");
      expect(promo).not.toHaveProperty("fecha_fin");
      expect(promo).not.toHaveProperty("metadata_visual");
      expect(promo).not.toHaveProperty("requiere_codigo");
    });

    test("listarAdmin -> short 5-field set", async () => {
      Producto.findAll.mockResolvedValue([makeProductoInstance()]);

      const req = { user: { id: 1, rol_id: 5 }, query: {}, params: {} };
      const res = createRes();
      const next = jest.fn();

      await productosCtrl.listarAdmin(req, res, next);

      expect(res.statusCode).toBe(200);
      const promo = res.body[0].promociones_activas[0];
      expect(promo).toEqual({
        id: "PROMO_ID_1",
        codigo: "PROMO_CODE_1",
        titulo: "PROMO_TITLE_1",
        tipo_descuento: "PROMO_TYPE_1",
        valor_descuento: "PROMO_VALUE_1",
      });
      expect(promo).not.toHaveProperty("descripcion");
      expect(promo).not.toHaveProperty("fecha_fin");
      expect(promo).not.toHaveProperty("metadata_visual");
      expect(promo).not.toHaveProperty("requiere_codigo");
    });

    test("obtener -> full 9-field set", async () => {
      Producto.findByPk.mockResolvedValue(makeProductoInstance());

      const req = { params: { id: "1" }, query: {} };
      const res = createRes();
      const next = jest.fn();

      await productosCtrl.obtener(req, res, next);

      expect(res.statusCode).toBe(200);
      const promo = res.body.promociones_activas[0];
      expect(promo).toEqual({
        id: "PROMO_ID_1",
        codigo: "PROMO_CODE_1",
        titulo: "PROMO_TITLE_1",
        descripcion: "PROMO_DESC_1",
        tipo_descuento: "PROMO_TYPE_1",
        valor_descuento: "PROMO_VALUE_1",
        fecha_fin: "PROMO_DATE_1",
        metadata_visual: "PROMO_META_1",
        requiere_codigo: "PROMO_REQ_1",
      });
    });

    test("obtenerPorSlug -> full 9-field set", async () => {
      Producto.findOne.mockResolvedValue(makeProductoInstance());

      const req = { params: { slug: "test-product" }, query: {} };
      const res = createRes();
      const next = jest.fn();

      await productosCtrl.obtenerPorSlug(req, res, next);

      expect(res.statusCode).toBe(200);
      const promo = res.body.promociones_activas[0];
      expect(promo).toEqual({
        id: "PROMO_ID_1",
        codigo: "PROMO_CODE_1",
        titulo: "PROMO_TITLE_1",
        descripcion: "PROMO_DESC_1",
        tipo_descuento: "PROMO_TYPE_1",
        valor_descuento: "PROMO_VALUE_1",
        fecha_fin: "PROMO_DATE_1",
        metadata_visual: "PROMO_META_1",
        requiere_codigo: "PROMO_REQ_1",
      });
    });
  });
});
