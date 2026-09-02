-- BusService.sql file for creating and populating the Intercity Bus Service database.
-- Referential integrity constraints are deliberately omitted from BusService.sql, 
-- and they must be added for the database to be consistent.

DROP DATABASE IF EXISTS BusService;
CREATE DATABASE BusService;
USE BusService;

DROP TABLE IF EXISTS TripPassengers;
DROP TABLE IF EXISTS Trip;
DROP TABLE IF EXISTS Bus;
DROP TABLE IF EXISTS Station;
DROP TABLE IF EXISTS Customer;

CREATE TABLE Station (
     stationID VARCHAR(5) PRIMARY KEY,
     city VARCHAR(20) NOT NULL
);

CREATE TABLE Bus (
     busLicensePlate VARCHAR(10) PRIMARY KEY,
     capacity INT NOT NULL -- number of available seats
);

CREATE TABLE Customer (
     CNO VARCHAR(10) PRIMARY KEY,
     cName VARCHAR(50)
);

CREATE TABLE Trip(
     tripID VARCHAR(10) PRIMARY KEY,
     depDate DATE NOT NULL,
     depTime TIME NOT NULL, -- in CET time zone
     duration TIME NOT NULL,
     fromStation VARCHAR(5) NOT NULL,
     toStation VARCHAR(5) NOT NULL,
     busLicensePlate VARCHAR(10)
);

CREATE TABLE TripPassengers (
     tripID VARCHAR(10),
     CNO CHAR(10), 
     price INT NOT NULL,
     PRIMARY KEY (tripID, CNO)	
);
        
INSERT INTO Station(stationID, city)
VALUES  ('DK001',	'Copenhagen'),
        ('IT001', 'Milan'),
        ('IT002', 'Milan'),
        ('DE001',	'Munich'),
        ('DE002', 'Munich');
	
INSERT INTO Bus (busLicensePlate, capacity)
VALUES	('DS45678', 2),
	    ('BE040CP', 150),
	    ('HGNST232', 200) ;

INSERT INTO Customer (CNO, cName)
VALUES	('C1', 'Christoph'), 
        ('C2', 'Anne'),
        ('C3', 'Giovanni'),
        ('C4', 'Alberto') ;
        
INSERT INTO 
Trip(tripID, depDate,      depTime,    duration,   fromStation,  toStation, busLicensePlate)
VALUES ('BusDK101', '2023-05-01', '10:30:00', '02:00:00', 'DK001',      'DE001',       'HGNST232'),
       ('BusDK421', '2023-05-04', '14:00:00', '02:00:00', 'DE001',      'DK001',       'HGNST232'),
       ('BusDK501', '2023-05-07', '08:00:00', '01:50:00', 'DK001',      'IT001',       'DS45678'),
       ('BusDK701', '2023-06-21', '20:00:00', '02:10:00', 'DK001',      'DE002',       null), 
       ('BusDK801', '2023-07-30', '16:00:00', '02:10:00', 'DE002',      'DK001',       'HGNST232'),
       ('BusDK802', '2023-07-30', '20:00:00', '02:10:00', 'DK001',      'DE002',       'HGNST232'),
       ('BusDK901', '2023-08-25', '08:00:00', '01:50:00', 'DK001',      'IT001',       null)
       ; 

INSERT INTO TripPassengers(tripID, CNO, price)
VALUES  ('BusDK101', 'C1', 1000),
        ('BusDK101', 'C2', 1250),
        ('BusDK421', 'C1', 1000),
        ('BusDK501', 'C1', 5000),
        ('BusDK501', 'C2', 5000),
        ('BusDK501', 'C3', 5000),
        ('BusDK701', 'C1',  900);

SELECT * FROM Customer;
SELECT * FROM Bus;
SELECT * FROM Station;
SELECT * FROM Trip;
SELECT * FROM TripPassengers;
