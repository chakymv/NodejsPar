-- Configuración inicial
SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- Crear esquema
CREATE SCHEMA IF NOT EXISTS `Parqueader_ssd` DEFAULT CHARACTER SET utf8mb4;
USE `Parqueader_ssd`;

-- Tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS `PERFIL_USUARIO` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `perfil` VARCHAR(45) NOT NULL
) ENGINE=InnoDB;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS `USUARIO` (
  `id_usuario` INT AUTO_INCREMENT PRIMARY KEY,
  `tipo_documento` VARCHAR(20) NOT NULL,
  `numero_documento` VARCHAR(45) NOT NULL UNIQUE,
  `primer_nombre` VARCHAR(100) NOT NULL,
  `segundo_nombre` VARCHAR(100),
  `primer_apellido` VARCHAR(100) NOT NULL,
  `segundo_apellido` VARCHAR(100),
  `direccion_correo` VARCHAR(255) NOT NULL UNIQUE,
  `numero_celular` VARCHAR(20) NOT NULL,
  `foto_perfil` VARCHAR(255),
  `estado` ENUM('activo', 'inactivo') NOT NULL,
  `clave` VARCHAR(255),
  `perfil_id` INT NOT NULL,
  FOREIGN KEY (`perfil_id`) REFERENCES `PERFIL_USUARIO`(`id`)
) ENGINE=InnoDB;

-- Tabla de vehículos
CREATE TABLE IF NOT EXISTS `VEHICULO` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `placa` VARCHAR(10) NOT NULL UNIQUE,
  `color` VARCHAR(45),
  `modelo` VARCHAR(45),
  `marca` VARCHAR(45),
  `tipo` VARCHAR(45),
  `usuario_id` INT NOT NULL,
  FOREIGN KEY (`usuario_id`) REFERENCES `USUARIO`(`id_usuario`)
) ENGINE=InnoDB;

-- Tabla de pico y placa
CREATE TABLE IF NOT EXISTS `PICO_PLACA` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tipo_vehiculo` VARCHAR(45),
  `numero` VARCHAR(10),
  `dia` VARCHAR(20)
) ENGINE=InnoDB;

-- Tabla de accesos y salidas
CREATE TABLE IF NOT EXISTS `ACCESO_SALIDAS` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `movimiento` ENUM('acceso', 'salida') NOT NULL,
  `fecha_hora` DATETIME NOT NULL,
  `puerta` VARCHAR(45),
  `tiempo_estadia` INT,
  `vehiculo_id` INT NOT NULL,
  FOREIGN KEY (`vehiculo_id`) REFERENCES `VEHICULO`(`id`)
) ENGINE=InnoDB;

-- Tabla de incidencias
CREATE TABLE IF NOT EXISTS `INCIDENCIA` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

-- Tabla de reporte de incidencias
CREATE TABLE IF NOT EXISTS `REPORTE_INCIDENCIA` (
  `vehiculo_id` INT NOT NULL,
  `incidencia_id` INT NOT NULL,
  `fecha_hora` DATETIME,
  PRIMARY KEY (`vehiculo_id`, `incidencia_id`),
  FOREIGN KEY (`vehiculo_id`) REFERENCES `VEHICULO`(`id`),
  FOREIGN KEY (`incidencia_id`) REFERENCES `INCIDENCIA`(`id`)
) ENGINE=InnoDB;

-- Tabla de celdas
CREATE TABLE IF NOT EXISTS `CELDA` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tipo` VARCHAR(45),
  `estado` ENUM('ocupada', 'libre') NOT NULL
) ENGINE=InnoDB;

-- Historial de parqueo
CREATE TABLE IF NOT EXISTS `HISTORIAL_PARQUEO` (
  `celda_id` INT NOT NULL,
  `vehiculo_id` INT NOT NULL,
  `fecha_hora` DATETIME,
  PRIMARY KEY (`celda_id`, `vehiculo_id`, `fecha_hora`),
  FOREIGN KEY (`celda_id`) REFERENCES `CELDA`(`id`),
  FOREIGN KEY (`vehiculo_id`) REFERENCES `VEHICULO`(`id`)
) ENGINE=InnoDB;

-- Restaurar configuración
SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;


