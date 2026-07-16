import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";
import type Producto from "./producto.model";

type PromocionTipo = "producto" | "categoria" | "global" | "por_cantidad";
type PromocionTipoDescuento = "porcentaje" | "fijo" | "2x1" | "3x2";
type PromocionEstado =
  "activo" | "programado" | "expirado" | "inactivo" | "pausado";

interface MetadataVisual {
  badge?: {
    texto?: string;
    posicion?: string;
    animacion?: string;
  };
  gradiente?: string[];
  badge_color?: string;
  mostrar_countdown?: boolean;
  mostrar_ahorro?: boolean;
  [key: string]: unknown;
}

interface ReglasAplicacion {
  productos_ids?: number[];
  categorias_ids?: number[];
  excluir_productos_ids?: number[];
  minimo_cantidad?: number;
  [key: string]: unknown;
}

class Promocion extends Model<
  InferAttributes<Promocion>,
  InferCreationAttributes<Promocion>
> {
  declare id: CreationOptional<number>;
  declare codigo: string | null;
  declare nombre: string;
  declare titulo: string;
  declare descripcion: string | null;
  declare tipo: CreationOptional<PromocionTipo>;
  declare tipo_descuento: CreationOptional<PromocionTipoDescuento>;
  declare valor_descuento: number;
  declare descuento_maximo: number | null;
  declare fecha_inicio: Date;
  declare fecha_fin: Date;
  declare cantidad_usos_maximos: number | null;
  declare cantidad_usos_actuales: CreationOptional<number>;
  declare usos_por_usuario: CreationOptional<number>;
  declare minimo_puntos: CreationOptional<number>;
  declare requiere_codigo: CreationOptional<boolean>;
  declare prioridad: CreationOptional<number>;
  declare estado: CreationOptional<PromocionEstado>;
  declare aplica_acumulacion: CreationOptional<boolean>;
  declare metadata_visual: CreationOptional<MetadataVisual | null>;
  declare reglas_aplicacion: CreationOptional<ReglasAplicacion | null>;
  declare creado_por: number | null;
  declare creado: CreationOptional<Date>;
  declare actualizado: CreationOptional<Date>;

  // Instance methods
  estaActiva(): boolean {
    const ahora = new Date();
    return (
      this.estado === "activo" &&
      ahora >= this.fecha_inicio &&
      ahora <= this.fecha_fin &&
      (this.cantidad_usos_maximos === null ||
        this.cantidad_usos_actuales < this.cantidad_usos_maximos)
    );
  }

  calcularDescuento(precioOriginal: number): number {
    let descuento = 0;

    switch (this.tipo_descuento) {
      case "porcentaje":
        descuento = Math.floor((precioOriginal * this.valor_descuento) / 100);
        if (this.descuento_maximo && descuento > this.descuento_maximo) {
          descuento = this.descuento_maximo;
        }
        break;
      case "fijo":
        descuento = this.valor_descuento;
        break;
      case "2x1":
      case "3x2":
        // For these types, the discount is calculated in the cart
        break;
    }

    return Math.min(descuento, precioOriginal);
  }

  async puedeUsarUsuario(usuarioId: number): Promise<boolean> {
    if (!usuarioId) return !this.requiere_codigo;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const UsoPromocion = require("./usoPromocion.model");
    const usosUsuario = await UsoPromocion.count({
      where: {
        promocion_id: this.id,
        usuario_id: usuarioId,
      },
    });

    return usosUsuario < this.usos_por_usuario;
  }

  // Association mixin methods (declared by belongsToMany in models/index.ts)
  declare addProductos: (
    productos: Producto[] | number[],
    options?: { transaction?: unknown }
  ) => Promise<void>;
  declare getProductos: () => Promise<Producto[]>;
  declare hasProductos: (productos: Producto[] | number[]) => Promise<boolean>;
}

Promocion.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    codigo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      comment: "Optional code for discount coupons (e.g.: VERANO2024)",
    },
    nombre: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: "Internal name of the promotion",
    },
    titulo: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Public title shown to the user",
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Detailed description of the promotion",
    },
    tipo: {
      type: DataTypes.ENUM("producto", "categoria", "global", "por_cantidad"),
      defaultValue: "producto",
      comment: "Promotion application type",
    },
    tipo_descuento: {
      type: DataTypes.ENUM("porcentaje", "fijo", "2x1", "3x2"),
      defaultValue: "porcentaje",
      comment: "Type of discount applied",
    },
    valor_descuento: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Discount value (percentage or fixed points)",
    },
    descuento_maximo: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Maximum discount in points (for percentages)",
    },
    fecha_inicio: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Promotion start date and time",
    },
    fecha_fin: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "Promotion end date and time",
    },
    cantidad_usos_maximos: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Total usage limit (null = unlimited)",
    },
    cantidad_usos_actuales: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Current usage counter",
    },
    usos_por_usuario: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: "Usage limit per user",
    },
    minimo_puntos: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Minimum points required to apply the promotion",
    },
    requiere_codigo: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Whether a coupon code is required or it is automatic",
    },
    prioridad: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Priority to resolve conflicts (higher = more priority)",
    },
    estado: {
      type: DataTypes.ENUM(
        "activo",
        "programado",
        "expirado",
        "inactivo",
        "pausado"
      ),
      defaultValue: "programado",
      comment: "Current state of the promotion",
    },
    aplica_acumulacion: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Whether it can be combined with other promotions",
    },
    metadata_visual: {
      type: DataTypes.JSON,
      allowNull: true,
      comment:
        "Visual configuration for the frontend (gradients, badges, etc.)",
      defaultValue: {
        badge: {
          texto: "OFERTA",
          posicion: "top-right",
          animacion: "pulse",
        },
        gradiente: ["#FF6B6B", "#FF8E53"],
        badge_color: "#FF0000",
        mostrar_countdown: true,
        mostrar_ahorro: true,
      },
    },
    reglas_aplicacion: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Application rules (products, categories, exclusions)",
      defaultValue: {
        productos_ids: [],
        categorias_ids: [],
        excluir_productos_ids: [],
        minimo_cantidad: 1,
      },
    },
    creado_por: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "ID of the admin user who created the promotion",
    },
    creado: {
      type: DataTypes.DATE,
    },
    actualizado: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "promociones",
    timestamps: true,
    createdAt: "creado",
    updatedAt: "actualizado",
    indexes: [
      {
        fields: ["codigo"],
      },
      {
        fields: ["estado"],
      },
      {
        fields: ["fecha_inicio", "fecha_fin"],
      },
      {
        fields: ["tipo"],
      },
    ],
    hooks: {
      beforeSave: (promocion: Promocion) => {
        // Validate that fecha_fin is greater than fecha_inicio
        if (promocion.fecha_fin <= promocion.fecha_inicio) {
          throw new Error("End date must be after start date");
        }

        // Validate discount
        if (
          promocion.tipo_descuento === "porcentaje" &&
          promocion.valor_descuento > 100
        ) {
          throw new Error("Percentage discount cannot be greater than 100%");
        }

        if (promocion.valor_descuento < 0) {
          throw new Error("Discount value cannot be negative");
        }

        // Auto-update state based on dates
        const ahora = new Date();
        if (promocion.estado !== "inactivo" && promocion.estado !== "pausado") {
          if (ahora < promocion.fecha_inicio) {
            promocion.estado = "programado";
          } else if (
            ahora >= promocion.fecha_inicio &&
            ahora <= promocion.fecha_fin
          ) {
            promocion.estado = "activo";
          } else if (ahora > promocion.fecha_fin) {
            promocion.estado = "expirado";
          }
        }
      },
    },
  }
);

export = Promocion;
