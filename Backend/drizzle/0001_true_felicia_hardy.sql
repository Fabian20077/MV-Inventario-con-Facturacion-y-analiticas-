CREATE TABLE `categorias` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nombre` varchar(100) NOT NULL,
	`descripcion` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categorias_id` PRIMARY KEY(`id`),
	CONSTRAINT `categorias_nombre_unique` UNIQUE(`nombre`)
);
--> statement-breakpoint
CREATE TABLE `movimientos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productoId` int NOT NULL,
	`tipo` enum('entrada','salida') NOT NULL,
	`cantidad` int NOT NULL,
	`motivo` text,
	`usuarioId` int NOT NULL,
	`fechaMovimiento` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `movimientos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku` varchar(50) NOT NULL,
	`nombre` varchar(200) NOT NULL,
	`descripcion` text,
	`precioVenta` int NOT NULL,
	`stockActual` int NOT NULL DEFAULT 0,
	`categoriaId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productos_id` PRIMARY KEY(`id`),
	CONSTRAINT `productos_sku_unique` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nombre` varchar(50) NOT NULL,
	`descripcion` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_nombre_unique` UNIQUE(`nombre`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `nombre` text;--> statement-breakpoint
ALTER TABLE `users` ADD `correo` varchar(320);--> statement-breakpoint
ALTER TABLE `users` ADD `activo` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `name`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `email`;