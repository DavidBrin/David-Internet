DROP DATABASE IF EXISTS cinema;
CREATE DATABASE cinema;
USE cinema;

DROP TABLE IF EXISTS `room`;
CREATE TABLE `room` (
  `rid` int(11) NOT NULL,
  `rname` varchar(50) NOT NULL,
  `screensize` int(11) NOT NULL,
  PRIMARY KEY (`rid`)
);

DROP TABLE IF EXISTS `seat`;
CREATE TABLE `seat` (
  `sno` int(11) NOT NULL,
  `rid` int(11) NOT NULL,
  `row` int(11) NOT NULL,
  PRIMARY KEY (`sno`,`rid`)
);

DROP TABLE IF EXISTS `movie`;
CREATE TABLE `movie` (
  `mid` int(11) NOT NULL,
  `title` varchar(100) NOT NULL,
  `genre` varchar(50) NOT NULL,
  PRIMARY KEY (`mid`)
);

DROP TABLE IF EXISTS `projection`;
CREATE TABLE `projection` (
  `pid` int(11) NOT NULL,
  `mid` int(11) NOT NULL,
  `rid` int(11) NOT NULL,
  `pdate` date NOT NULL,
  PRIMARY KEY (`pid`)
);

DROP TABLE IF EXISTS `ticket`;
CREATE TABLE `ticket` (
  `tid` int(11) NOT NULL,
  `pid` int(11) NOT NULL,
  `sno` int(11) NOT NULL,
  `rid` int(11) NOT NULL,
  `price` int(11) NOT NULL,
  PRIMARY KEY (`tid`)
);

INSERT INTO `room` VALUES 
(1,'Diamond',20),
(2,'Sapphire',10),
(3,'Ruby',5);

INSERT INTO `seat` VALUES 
(1,1,1),
(2,1,2),
(3,1,2),
(1,2,1),
(2,2,2),
(3,2,3),
(1,3,1),
(2,3,2),
(3,3,3);

INSERT INTO `movie` VALUES 
(1,'Trading Places','Comedy'),
(2,'Stargate','Sci-Fi'),
(3,'First Blood','Action'),
(4,'Going with the Wind','Drama'),
(5,'The Wizard of Oz','Fantasy'),
(6,'2001 a Space Odyssey','Sci-Fi'),
(7,'The Producers','Comedy');

INSERT INTO `projection` VALUES 
(1,1,1,'2025-12-19'),
(2,2,1,'2025-12-20'),
(3,2,2,'2025-12-19'),
(4,2,3,'2025-12-21'),
(5,3,3,'2025-12-19'),
(6,4,2,'2025-12-20'),
(7,5,3,'2025-12-20'),
(8,6,1,'2025-12-21'),
(9,7,2,'2025-12-21');

INSERT INTO `ticket` VALUES 
(1,1,1,1,150),
(2,1,2,1,160),
(3,1,3,1,160),
(4,2,3,1,150),
(5,3,2,2,110),
(6,4,1,3,120),
(7,5,2,3,120),
(8,6,3,2,130),
(9,7,1,3,110),
(10,8,1,1,130),
(11,8,2,1,140),
(12,9,2,2,150);
