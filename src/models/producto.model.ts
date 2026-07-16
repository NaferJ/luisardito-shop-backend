import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import { sequelize } from "./database";

// Slug generation helper
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars except spaces and hyphens
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

type ProductoEstado = "publicado" | "borrador" | "eliminado";

class Producto extends Model<
  InferAttributes<Producto>,
  InferCreationAttributes<Producto>
> {
  declare id: CreationOptional<number>;
  declare nombre: string;
  declare descripcion: string | null;
  declare precio: number;
  declare stock: number | null;
  declare estado: CreationOptional<ProductoEstado>;
  declare imagen_url: string | null;
  declare slug: string | null;
  declare creado: CreationOptional<Date>;
  declare actualizado: CreationOptional<Date>;
}

Producto.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    precio: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    estado: {
      type: DataTypes.ENUM("publicado", "borrador", "eliminado"),
      defaultValue: "borrador",
    },
    imagen_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
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
    tableName: "productos",
    timestamps: true,
    createdAt: "creado",
    updatedAt: "actualizado",
    hooks: {
      beforeCreate: (producto: Producto) => {
        if (producto.nombre && !producto.slug) {
          producto.slug = generateSlug(producto.nombre);
        }
      },
      beforeUpdate: (producto: Producto) => {
        if (producto.nombre && producto.changed("nombre")) {
          producto.slug = generateSlug(producto.nombre);
        }
      },
    },
  }
);

export = Producto;
