-- Please fill out the following mandatory information:
-- Student number: s123456

-- -----------------------------------------------------------------------------------------------------
-- q1.1: Answer to question 1.1 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
-- Write an SQL query, which returns a table containing, for each trip, the tripID
SELECT tripID
FROM Trip

--	tripID	   
--  -----------
--  BusDK101
--  BusDK421
--  BusDK501
--  BusDK701
--  BusDK801
--  BusDK802
--  BusDK901

-- -----------------------------------------------------------------------------------------------------
-- q1.2: Answer to question 1.2 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
-- Modify the SQL query you wrote to answer question 1.1 to return a table containing, for each trip,
-- the tripID and the CNO of the customers who booked that trip. The tripID of trips with no customers
-- should also be returned
SELECT tripID, CNO
FROM Trip NATURAL LEFT JOIN TripPassengers

--	tripID	   CNO
--  ----------------------
--  BusDK101   C1
--  BusDK101   C2
--  BusDK421   C1
--  BusDK501   C1
--  BusDK501   C2
--  BusDK501   C3
--  BusDK701   C1
--  BusDK801   NULL
--  BusDK802   NULL
--  BusDK901   NULL

-- -----------------------------------------------------------------------------------------------------
-- q1.3: Answer to question 1.3 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
-- Modify the SQL query you wrote to answer question 1.2 to return a table containing, for each trip,
-- the tripID and the number of passengers. For the number of passengers, use attribute name 
-- count_passengers
SELECT tripID, count(CNO) AS count_passengers
FROM Trip NATURAL LEFT JOIN TripPassengers
GROUP BY tripID;

--	tripID	   count_passengers
--  ---------------------------
--  BusDK101   2
--  BusDK421   1
--  BusDK501   3
--  BusDK701   1
--  BusDK801   0
--  BusDK802   0
--  BusDK901   0

-- -----------------------------------------------------------------------------------------------------
-- q2.1: Answer to question 2.1 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
-- Write an SQL query, which returns a table containing the CNO of each customer who has not been 
-- booked on any trip
SELECT CNO
FROM  Customer  
WHERE CNO NOT IN (
    SELECT CNO 
	FROM TripPassengers);

--	CNO	
--  -----
--	C4	

-- -----------------------------------------------------------------------------------------------------
-- q2.2: Answer to question 2.2 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
-- Modify the SQL query you wrote to answer question 2.1 to return a table containing the CNO of each
-- customer who has not been booked on a trip to station DK001
SELECT CNO
FROM  Customer  
WHERE CNO NOT IN (
    SELECT CNO 
	FROM TripPassengers NATURAL JOIN Trip
	WHERE toStation = 'DK001');

--	CNO	
--  -----
--	C2	
--	C3
--	C4	

-- -----------------------------------------------------------------------------------------------------
-- q2.3: Answer to question 2.3 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
-- Modify the SQL query you wrote to answer question 2.2 to return a table containing the CNO of each
-- customer who has not been booked on a trip to any station in Copenhagen
SELECT CNO
FROM  Customer  
WHERE CNO NOT IN (
    SELECT CNO 
	FROM TripPassengers NATURAL JOIN Trip JOIN Station ON toStation = stationID
	WHERE city = 'Copenhagen');

--	CNO	
--  -----
--	C2	
--	C3
--	C4	
		
-- -----------------------------------------------------------------------------------------------------
-- q3.1: Answer to question 3.1 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
-- Define an SQL trigger named Trip_Before_Insert, which automatically raises a signal when a new row
-- having the same fromStation and toStation is attempted to be inserted in the Trip table.
DROP TRIGGER IF EXISTS  Trip_Before_Insert;
DELIMITER $$
CREATE TRIGGER Trip_Before_Insert
BEFORE INSERT ON Trip  FOR EACH ROW
IF NEW.fromStation = NEW.toStation 
THEN  SIGNAL SQLSTATE 'HY000' SET MYSQL_ERRNO = 1525, 
      MESSAGE_TEXT = 'fromStation and toStation must be different';
END IF;      
$$
DELIMITER ;

-- -----------------------------------------------------------------------------------------------------
-- q3.2: Answer to question 3.2 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
-- Modify the trigger you wrote to answer question 3.2 to automatically raise a signal when a new row
-- having both stations specified in fromStation and toStation in the same city is attempted to be
-- inserted in the Trip table. 
DROP TRIGGER IF EXISTS  Trip_Before_Insert;
DELIMITER $$
CREATE TRIGGER Trip_Before_Insert
BEFORE INSERT ON Trip  FOR EACH ROW
IF (SELECT city FROM Station WHERE stationID = NEW.fromStation) = 
	(SELECT city FROM Station WHERE stationID = NEW.toStation)
THEN  SIGNAL SQLSTATE 'HY000' SET MYSQL_ERRNO = 1525, 
      MESSAGE_TEXT = 'fromStation and toStation must be in different cities';
END IF;      
$$
DELIMITER ;

-- -----------------------------------------------------------------------------------------------------
-- q3.3: Answer to question 3.3 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
-- Show an example of an SQL statement which causes the trigger you wrote to answer question 3.1 to
-- raise a signal
INSERT INTO 
Trip(tripID, depDate,      depTime,    duration,   fromStation,  toStation, busLicensePlate)
VALUES ('BusDK000', '2023-05-01', '10:30:00', '02:10:00', 'DK001',      'DK001',       'HGNST232');