# -*- coding: ascii -*-
"""SQL Playground demo prep (run via scripts/demos/sql.ts -> py -3.12).

argv: rawRoot (demos/), outDir (public/demos/sql), repoRoot.

Everything runs in the browser via sql.js, so this prep
  1. translates the MariaDB schema scripts to SQLite, executes them with the
     stdlib sqlite3, and ships the resulting .sqlite files (a few KB each),
  2. synthesizes the bike-shop schema of the group's design project (only the
     Data Sheet and the Data Modification script survive - the DDL never did;
     reconstructed and disclosed),
  3. ships schemas.json: per-database table/column/FK graphs (hand-coded from
     the DDL) for the schema diagrams,
  4. ships presets.json: the weekly answer queries with labels - verbatim
     where SQLite runs them, adapted (and labeled) where the original used
     MariaDB-only features (session variables, stored functions, >= ALL,
     SIGNAL triggers),
  5. compresses the two hand-drawn ER designs + the data sheet to WebP,
  6. vendors the original .sql files to demos/sql_src/ (student ID scrubbed),
  7. writes tests/fixtures/sql-presets.json: every runnable preset executed by
     python sqlite3 against the shipped DBs - the sql.js path is tested
     against it in tests/sql-core.test.ts.

Console is cp1252: ASCII-only prints.
"""
import json
import os
import re
import sqlite3
import sys

from PIL import Image

RAW = os.path.join(sys.argv[1], "dtu_databases_raw")
OUT = sys.argv[2]
REPO = sys.argv[3]
SRC_DIR = os.path.join(REPO, "demos", "sql_src")
FIX_DIR = os.path.join(REPO, "tests", "fixtures")

STUDENT_ID = "s251557"  # scrubbed from vendored sources


def read_raw(name):
    with open(os.path.join(RAW, name), encoding="utf-8", errors="replace") as f:
        return f.read()


# ------------------------------------------------------------- translation

def translate_mariadb(sql):
    """MariaDB -> SQLite for these course scripts (targeted, not general)."""
    out = []
    for line in sql.splitlines():
        ls = line.strip()
        if ls.startswith("#"):
            continue
        if re.match(r"(?i)^(drop\s+database|create\s+database|use)\b", ls):
            continue
        out.append(line)
    s = "\n".join(out)
    s = re.sub(r"(?i)\bENUM\s*\([^)]*\)", "TEXT", s)
    s = re.sub(r"(?i)\bYEAR\b", "INTEGER", s)
    s = re.sub(r"(?i)^\s*INSERT\s+(?!INTO)(\w+)", lambda m: "INSERT INTO " + m.group(1), s, flags=re.M)
    return s


def build_db(name, ddl_sql, extra_sql=""):
    path = os.path.join(OUT, "db", name + ".sqlite")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        os.remove(path)
    con = sqlite3.connect(path)
    con.executescript(ddl_sql)
    if extra_sql:
        con.executescript(extra_sql)
    con.commit()
    n_tables = con.execute("select count(*) from sqlite_master where type='table'").fetchone()[0]
    con.close()
    print("db %s.sqlite: %d tables, %d KB" % (name, n_tables, max(1, os.path.getsize(path) // 1024)))
    return path


BIKESHOP_DDL = """
-- Bike-shop schema RECONSTRUCTED for this demo (2026-09-01) from the design
-- project's Data Sheet and Data Modification script - the group's own DDL was
-- never archived. Seed rows: customers/bikes/manufacturers from the data
-- sheet; parts/repairs invented to satisfy the modification script.
CREATE TABLE Customer (
    customer_id VARCHAR(10) PRIMARY KEY,  -- CPR number
    email VARCHAR(50), phone VARCHAR(20), full_name VARCHAR(50));
CREATE TABLE Address (
    customer_id VARCHAR(10) PRIMARY KEY REFERENCES Customer(customer_id),
    street_name VARCHAR(40), civic_number INT, city VARCHAR(30),
    zip_code VARCHAR(8), county VARCHAR(30));
CREATE TABLE Bike (
    bike_id VARCHAR(6) PRIMARY KEY, type VARCHAR(20), speeds INT, weight_kg REAL, wheel_in INT);
CREATE TABLE Parts (
    part_id VARCHAR(6) PRIMARY KEY, part_name VARCHAR(40), price INT, manufacturer VARCHAR(30));
CREATE TABLE Repair_Jobs (
    repair_id VARCHAR(6) PRIMARY KEY, rdate VARCHAR(12), duration_days INT, cost INT,
    customer_id VARCHAR(10) REFERENCES Customer(customer_id),
    bike_id VARCHAR(6) REFERENCES Bike(bike_id), rating INT);
CREATE TABLE Parts_Used (
    repair_id VARCHAR(6) REFERENCES Repair_Jobs(repair_id),
    part_id VARCHAR(6) REFERENCES Parts(part_id),
    PRIMARY KEY (repair_id, part_id));
CREATE TABLE Owns (
    customer_id VARCHAR(10) REFERENCES Customer(customer_id),
    bike_id VARCHAR(6) REFERENCES Bike(bike_id),
    PRIMARY KEY (customer_id, bike_id));
CREATE TABLE Compatible (
    part_id VARCHAR(6) REFERENCES Parts(part_id),
    bike_id VARCHAR(6) REFERENCES Bike(bike_id),
    PRIMARY KEY (part_id, bike_id));

-- data sheet rows
INSERT INTO Customer VALUES
 ('123456-7890','john.doe@gmail.com','22223333','John Doe'),
 ('234567-8901','anna.smith@gmail.com','33334444','Anna Smith'),
 ('345678-9012','mike.jensen@gmail.com','44445555','Mike Jensen'),
 ('250388-5678','sofie_p@mail.com','60224466','Sofie Petersen'),
 ('100795-1234','elias.jorgensen@mail.dk','50112233','Elias Jorgensen'),
 ('011175-9012','lars.hansen@email.dk','71335577','Lars Hansen'),
 ('150600-3456','ida.nielsen@post.dk','80446688','Ida Nielsen');
INSERT INTO Address VALUES
 ('123456-7890','Elm Street',12,'Copenhagen','2100','Hovedstaden'),
 ('234567-8901','Oak Road',45,'Aarhus','8000','Midtjylland'),
 ('345678-9012','Birch Lane',8,'Odense','5000','Syddanmark'),
 ('250388-5678','Vestergade',7,'Odense','5000','Syddanmark'),
 ('100795-1234','Falkoner Alle',69,'Frederiksberg','2000','Hovedstaden'),
 ('011175-9012','Fysikvej',3,'Lyngby','2800','Hovedstaden'),
 ('150600-3456','Skovvej',2,'Aarhus','8000','Midtjylland');
INSERT INTO Bike VALUES
 ('B001','Road',21,8.2,28),('B002','City',7,10.5,28),('B003','Mountain',18,9.1,26),
 ('B004','BMX',7,5.3,20),('B005','Kid',3,5.5,16),('B006','City',13,10.0,28),
 ('B007','Mountain',21,8.2,26);
INSERT INTO Owns VALUES
 ('123456-7890','B001'),('234567-8901','B002'),('345678-9012','B003'),
 ('250388-5678','B004'),('100795-1234','B005'),('011175-9012','B006'),
 ('150600-3456','B007');
-- invented parts/repairs (the modification script needs P101/P102/P103/P109 to exist)
INSERT INTO Parts VALUES
 ('P101','Chain',150,'Shimano'),('P102','Brake Pads',90,'Shimano'),
 ('P103','Rear Wheel',400,'Trek'),('P104','Saddle',250,'Giant'),
 ('P105','Pedals',120,'Batavus'),('P106','Handlebar',300,'Avenue'),
 ('P107','Bell',45,'Kildemose'),('P109','Gear Cable',60,'Shimano');
INSERT INTO Repair_Jobs VALUES
 ('P001','3/10/2025',1,350,'123456-7890','B001',4),
 ('P002','12/10/2025',2,700,'234567-8901','B002',5),
 ('P003','28/11/2025',1,150,'345678-9012','B003',3),
 ('P004','02/12/2025',4,1200,'011175-9012','B006',5);
INSERT INTO Parts_Used VALUES
 ('P001','P101'),('P002','P103'),('P002','P102'),('P003','P107'),('P004','P106'),('P004','P101');
INSERT INTO Compatible VALUES
 ('P101','B001'),('P101','B002'),('P101','B006'),('P102','B002'),('P103','B002'),
 ('P104','B003'),('P105','B004'),('P106','B006'),('P107','B003'),('P109','B001');
"""


def prep_dbs():
    dbs = {}
    dbs["university"] = build_db("university", translate_mariadb(read_raw("UniversityDB.sql")))
    dbs["family"] = build_db("family", translate_mariadb(read_raw("FamilyDB.sql")))
    dbs["cinema"] = build_db("cinema", translate_mariadb(read_raw("cinema.sql")))
    dbs["takeaway"] = build_db("takeaway", translate_mariadb(read_raw("w12_part1_database.sql")))
    dbs["busservice"] = build_db("busservice", translate_mariadb(read_raw("w13_part1_database.sql")))
    dbs["bikeshop"] = build_db("bikeshop", BIKESHOP_DDL)
    return dbs


# ------------------------------------------------------------- schema graphs
# Hand-coded from the DDL: tables with columns (pk marked), FK edges.

SCHEMAS = {
    "university": {
        "title": "University", "origin": "UniversityDB.sql: the Silberschatz textbook script the course ships (naming polished)",
        "tables": {
            "Classroom": {"pk": ["Building", "Room"], "cols": ["Building", "Room", "Capacity"]},
            "Department": {"pk": ["DeptName"], "cols": ["DeptName", "Building", "Budget"]},
            "Course": {"pk": ["CourseID"], "cols": ["CourseID", "Title", "DeptName", "Credits"]},
            "Instructor": {"pk": ["InstID"], "cols": ["InstID", "InstName", "DeptName", "Salary"]},
            "Section": {"pk": ["CourseID", "SectionID", "Semester", "StudyYear"], "cols": ["CourseID", "SectionID", "Semester", "StudyYear", "Building", "Room", "TimeSlotID"]},
            "Teaches": {"pk": ["InstID", "CourseID", "SectionID", "Semester", "StudyYear"], "cols": ["InstID", "CourseID", "SectionID", "Semester", "StudyYear"]},
            "Student": {"pk": ["StudID"], "cols": ["StudID", "StudName", "Birth", "DeptName", "TotCredits"]},
            "Takes": {"pk": ["StudID", "CourseID", "SectionID", "Semester", "StudyYear"], "cols": ["StudID", "CourseID", "SectionID", "Semester", "StudyYear", "Grade"]},
            "Advisor": {"pk": ["StudID"], "cols": ["StudID", "InstID"]},
            "TimeSlot": {"pk": ["TimeSlotID", "DayCode", "StartTime"], "cols": ["TimeSlotID", "DayCode", "StartTime", "EndTime"]},
            "PreReq": {"pk": ["CourseID", "PreReqID"], "cols": ["CourseID", "PreReqID"]},
        },
        "fks": [
            ["Course.DeptName", "Department.DeptName"], ["Instructor.DeptName", "Department.DeptName"],
            ["Section.CourseID", "Course.CourseID"], ["Section.Building", "Classroom.Building"],
            ["Teaches.CourseID", "Section.CourseID"], ["Teaches.InstID", "Instructor.InstID"],
            ["Student.DeptName", "Department.DeptName"],
            ["Takes.CourseID", "Section.CourseID"], ["Takes.StudID", "Student.StudID"],
            ["Advisor.InstID", "Instructor.InstID"], ["Advisor.StudID", "Student.StudID"],
            ["PreReq.CourseID", "Course.CourseID"], ["PreReq.PreReqID", "Course.CourseID"],
        ],
    },
    "family": {
        "title": "Family", "origin": "FamilyDB.sql: the first-week warm-up (one table, two rows)",
        "tables": {"family": {"pk": ["PersonName"], "cols": ["PersonName", "Birthday"]}},
        "fks": [],
    },
    "cinema": {
        "title": "Cinema", "origin": "cinema.sql: the exam database (rooms, seats, movies, projections, tickets)",
        "tables": {
            "room": {"pk": ["rid"], "cols": ["rid", "rname", "screensize"]},
            "seat": {"pk": ["sno", "rid"], "cols": ["sno", "rid", "row"]},
            "movie": {"pk": ["mid"], "cols": ["mid", "title", "genre"]},
            "projection": {"pk": ["pid"], "cols": ["pid", "mid", "rid", "pdate"]},
            "ticket": {"pk": ["tid"], "cols": ["tid", "pid", "sno", "rid", "price"]},
        },
        "fks": [
            ["seat.rid", "room.rid"], ["projection.mid", "movie.mid"], ["projection.rid", "room.rid"],
            ["ticket.pid", "projection.pid"], ["ticket.sno", "seat.sno"],
        ],
    },
    "takeaway": {
        "title": "Takeaway", "origin": "w12_part1_database.sql: provided; integrity constraints were the exercise",
        "tables": {
            "FoodCategory": {"pk": ["catId"], "cols": ["catId", "catName"]},
            "FoodItem": {"pk": ["itemId"], "cols": ["itemId", "description", "catId", "unitPrice"]},
            "Customer": {"pk": ["custNo"], "cols": ["custNo", "name"]},
            "FoodOrder": {"pk": ["orderNo"], "cols": ["orderNo", "custNo"]},
            "OrderLine": {"pk": ["orderNo", "lineNo"], "cols": ["orderNo", "lineNo", "itemId", "quantity", "unitPrice"]},
        },
        "fks": [
            ["FoodItem.catId", "FoodCategory.catId"], ["FoodOrder.custNo", "Customer.custNo"],
            ["OrderLine.orderNo", "FoodOrder.orderNo"], ["OrderLine.itemId", "FoodItem.itemId"],
        ],
    },
    "busservice": {
        "title": "Bus Service", "origin": "w13_part1_database.sql: provided; referential integrity deliberately omitted",
        "tables": {
            "Station": {"pk": ["stationID"], "cols": ["stationID", "city"]},
            "Bus": {"pk": ["busLicensePlate"], "cols": ["busLicensePlate", "capacity"]},
            "Customer": {"pk": ["CNO"], "cols": ["CNO", "cName"]},
            "Trip": {"pk": ["tripID"], "cols": ["tripID", "depDate", "depTime", "duration", "fromStation", "toStation", "busLicensePlate"]},
            "TripPassengers": {"pk": ["tripID", "CNO"], "cols": ["tripID", "CNO", "price"]},
        },
        "fks": [
            ["Trip.fromStation", "Station.stationID"], ["Trip.toStation", "Station.stationID"],
            ["Trip.busLicensePlate", "Bus.busLicensePlate"],
            ["TripPassengers.tripID", "Trip.tripID"], ["TripPassengers.CNO", "Customer.CNO"],
        ],
    },
    "bikeshop": {
        "title": "Bike Shop", "origin": "RECONSTRUCTED (2026-09-01) from the design project's Data Sheet + Data Modification script; the group's DDL was never archived",
        "tables": {
            "Customer": {"pk": ["customer_id"], "cols": ["customer_id", "email", "phone", "full_name"]},
            "Address": {"pk": ["customer_id"], "cols": ["customer_id", "street_name", "civic_number", "city", "zip_code", "county"]},
            "Bike": {"pk": ["bike_id"], "cols": ["bike_id", "type", "speeds", "weight_kg", "wheel_in"]},
            "Parts": {"pk": ["part_id"], "cols": ["part_id", "part_name", "price", "manufacturer"]},
            "Repair_Jobs": {"pk": ["repair_id"], "cols": ["repair_id", "rdate", "duration_days", "cost", "customer_id", "bike_id", "rating"]},
            "Parts_Used": {"pk": ["repair_id", "part_id"], "cols": ["repair_id", "part_id"]},
            "Owns": {"pk": ["customer_id", "bike_id"], "cols": ["customer_id", "bike_id"]},
            "Compatible": {"pk": ["part_id", "bike_id"], "cols": ["part_id", "bike_id"]},
        },
        "fks": [
            ["Address.customer_id", "Customer.customer_id"],
            ["Repair_Jobs.customer_id", "Customer.customer_id"], ["Repair_Jobs.bike_id", "Bike.bike_id"],
            ["Parts_Used.repair_id", "Repair_Jobs.repair_id"], ["Parts_Used.part_id", "Parts.part_id"],
            ["Owns.customer_id", "Customer.customer_id"], ["Owns.bike_id", "Bike.bike_id"],
            ["Compatible.part_id", "Parts.part_id"], ["Compatible.bike_id", "Bike.bike_id"],
        ],
    },
}


# ------------------------------------------------------------- presets
# sql: what runs in sql.js (SQLite). original: shown when it differs (MariaDB).
# Verbatim queries come straight from the answer files.

def P(pid, label, sql, original=None, note=None, expectError=False):
    d = {"id": pid, "label": label, "sql": sql.strip()}
    if original:
        d["original"] = original.strip()
    if note:
        d["note"] = note
    if expectError:
        d["expectError"] = True
    return d


PRESETS = {
    "family": [
        P("fam1", "The whole family", "SELECT * FROM family;"),
    ],
    "university": [
        P("uni1", "Students still waiting for a grade",
          "SELECT StudID, StudName\nFROM student NATURAL JOIN takes\nWHERE Grade IS NULL;"),
        P("uni2", "Per department: courses offered + average credits",
          "SELECT DeptName, count(*), avg(Credits)\nFROM course\nGROUP BY DeptName\nORDER BY avg(Credits) DESC, DeptName;"),
        P("uni3", "Per student: courses taken vs passed",
          "SELECT StudID, StudName, count(CourseID), count(Grade)\nFROM takes NATURAL JOIN student\nGROUP BY StudID;",
          note="count(Grade) skips NULLs; that asymmetry is the whole trick."),
        P("uni4", "Courses above their department's average credits",
          "SELECT CourseID, Title, Credits\nFROM course AS c1\nWHERE credits > (SELECT avg(c2.Credits)\n    FROM course AS c2\n    WHERE c2.DeptName = c1.DeptName);",
          note="The correlated subquery, week 3's boss fight (the notebook kept two wrong attempts above it)."),
        P("uni5", "Courses with no prerequisites",
          "SELECT CourseID, Title\nFROM course\nWHERE CourseID NOT IN (\n    SELECT CourseID\n    FROM Prereq);"),
        P("uni6", "Students who never enrolled in anything",
          "SELECT StudName\nFROM student\nWHERE StudID NOT IN (\n    SELECT StudID FROM takes);"),
        P("uni7", "Instructors who taught in spring 2009",
          "SELECT InstID, InstName\nFROM instructor WHERE InstID IN (SELECT InstID\nFROM teaches WHERE Semester = 'Spring' AND StudyYear = '2009');"),
        P("uni8", "Who taught the most sections in spring 2009",
          "SELECT InstID, InstName, count(*)\nFROM instructor NATURAL JOIN Teaches\nWHERE Semester = 'Spring' AND StudyYear = '2009'\nGROUP BY InstID\nHAVING count(*) >= (\n    SELECT max(cnt) FROM (\n        SELECT count(*) AS cnt\n        FROM instructor NATURAL JOIN Teaches\n        WHERE Semester = 'Spring' AND StudyYear = '2009'\n        GROUP BY InstID));",
          original="Select InstID, InstName, Count(*)\nFrom instructor natural join Teaches\n where Semester = 'Spring' and StudyYear = '2009'\n group by InstID\nhaving count(*) >= ALL (Select  Count(*)\n\tFrom instructor natural join Teaches\n\twhere Semester = 'Spring' and StudyYear = '2009'\n\tgroup by InstID);",
          note="Adapted: SQLite has no quantified >= ALL, so the inner counts collapse to max()."),
        P("uni9", "Least-taken spring 2009 courses (zero students count too)",
          "SELECT CourseID, Title, count(StudID)\nFROM course NATURAL JOIN section NATURAL LEFT JOIN takes\nWHERE semester = 'Spring' AND StudyYear = 2009\nGROUP BY CourseID\nHAVING count(StudID) <= (\n    SELECT min(cnt) FROM (\n        SELECT count(StudID) AS cnt\n        FROM section NATURAL LEFT JOIN takes\n        WHERE semester = 'Spring' AND StudyYear = 2009\n        GROUP BY CourseID));",
          original="Select CourseID, Title, Count(StudID)\nFrom course natural join section natural left join takes\nwhere semester = \"Spring\" and StudyYear=2009\ngroup by CourseID\nhaving count(StudID) <= all (Select Count(StudID)\n\tFrom section natural left join takes\n\twhere semester = \"Spring\" and StudyYear=2009\n    group by CourseID);",
          note="Adapted: <= ALL becomes min(); the natural LEFT join keeps courses nobody took."),
        P("uni10", "Students taking more courses than average",
          "WITH courseTaken(StudID, NumCourses) AS (\n    SELECT StudID, count(CourseID)\n    FROM student NATURAL LEFT JOIN takes\n    GROUP BY StudID)\nSELECT StudID, StudName\nFROM student NATURAL JOIN courseTaken\nWHERE NumCourses > (SELECT avg(NumCourses) FROM courseTaken);",
          original="drop view if exists courseTaken;\ncreate view courseTaken (StudID, NumCourses) as\nSelect StudID, Count(CourseID)\nfrom student natural left join takes\ngroup by studID;\n\nselect StudID, StudName\nfrom student natural join courseTaken\nwhere NumCourses > (Select avg(NumCourses)\n\tfrom courseTaken);",
          note="Adapted: the original's CREATE VIEW becomes a CTE so the preset leaves no state behind."),
    ],
    "cinema": [
        P("cin1", "1.1 Tickets over 120 DKK",
          "SELECT tid\nFROM ticket\nWHERE price > 120;"),
        P("cin2", "1.2 Tickets to Sci-Fi movies",
          "SELECT tid\nFROM ticket NATURAL JOIN projection NATURAL JOIN movie\nWHERE genre = 'Sci-Fi';",
          note="Quoting adapted: MariaDB lets strings live in double quotes, SQLite prefers single."),
        P("cin3", "1.3 Sci-Fi tickets for movies never shown in Ruby",
          "SELECT tid\nFROM ticket NATURAL JOIN projection NATURAL JOIN movie NATURAL JOIN room\nWHERE genre = 'Sci-Fi' AND mid NOT IN (\n    SELECT mid FROM projection NATURAL JOIN room WHERE rname = 'Ruby');"),
        P("cin4", "2.1 Income per movie",
          "SELECT mid, title, genre, sum(price) AS income\nFROM movie NATURAL JOIN projection NATURAL JOIN ticket\nGROUP BY mid;"),
        P("cin5", "2.2 Movies earning above the average",
          "WITH incomeview AS (\n    SELECT mid, title, genre, sum(price) AS income\n    FROM movie NATURAL JOIN projection NATURAL JOIN ticket\n    GROUP BY mid)\nSELECT mid, title, genre, income\nFROM incomeview\nWHERE income > (SELECT avg(income) FROM incomeview);",
          original="Create view incomeview as\nselect mid, title, genre, sum(price) as income\nfrom movie natural join projection natural join ticket\ngroup by mid;\nset @aveinc = (Select avg(income) from incomeview);\nselect mid, title, genre, income\nfrom incomeview\ngroup by mid\nhaving income > @aveinc;",
          note="Adapted: the original parked the average in a MariaDB session variable (@aveinc); a CTE + subquery does it statelessly."),
        P("cin6", "2.3 Movies at or above their genre's average income",
          "WITH incomeview AS (\n    SELECT mid, title, genre, sum(price) AS income\n    FROM movie NATURAL JOIN projection NATURAL JOIN ticket\n    GROUP BY mid)\nSELECT mid, title, genre, income\nFROM incomeview AS i1\nWHERE income >= (SELECT avg(income) FROM incomeview AS i2 WHERE i1.genre = i2.genre);"),
        P("cin7", "3.2 Reserved seats per room on Dec 19",
          "SELECT rid, (\n    SELECT count(tid)\n    FROM projection AS p2 NATURAL JOIN ticket\n    WHERE p2.rid = p1.rid AND p2.pdate = p1.pdate) AS reserved_seats\nFROM projection AS p1 WHERE pdate = '2025-12-19';",
          original="drop function if exists reservedSeats;\ncreate function\nreservedSeats(ridn int(3), pdaten date) returns int\nreturn\n\t(Select count(tid) as reservations\n    from Projection natural join ticket\n    where rid = ridn and pdate = pdaten);\n\nSelect rid, reservedSeats(rid, pdate) as reserved_seats\nfrom projection where pdate = '2025-12-19';",
          note="Adapted: the original defined a MariaDB stored function reservedSeats(rid, pdate); SQLite has no stored functions, so it inlines as a correlated subquery."),
        P("cin8", "3.3 Empty seats per projection",
          "SELECT pid, count(sno) - (\n    SELECT count(tid)\n    FROM projection AS p2 NATURAL JOIN ticket\n    WHERE p2.rid = p1.rid AND p2.pdate = p1.pdate) AS empty_seats\nFROM projection AS p1 NATURAL JOIN seat\nGROUP BY pid;",
          original="Select pid, count(sno)-reservedSeats(rid, pdate) as empty_seats\nfrom projection natural join seat\ngroup by pid;",
          note="Adapted: same stored function, inlined."),
    ],
    "takeaway": [
        P("tak1", "1.1 Every food category",
          "SELECT catId, catName\nFROM FoodCategory;"),
        P("tak2", "1.2 Categories with their items (empty ones too)",
          "SELECT catId, catName, itemId, unitPrice\nFROM FoodCategory NATURAL LEFT JOIN FoodItem;"),
        P("tak3", "1.3 Priciest item per category",
          "SELECT catId, catName, max(unitPrice) AS highest_price\nFROM FoodCategory NATURAL LEFT JOIN FoodItem\nGROUP BY catId;"),
        P("tak4", "2.1 Items never ordered",
          "SELECT itemId, description FROM foodItem\nWHERE itemId NOT IN (SELECT itemId FROM orderline);"),
        P("tak5", "2.2 Items never ordered by Peter Pan",
          "SELECT itemId, description FROM foodItem\nWHERE itemId NOT IN (SELECT itemId\n    FROM orderline NATURAL JOIN foodOrder NATURAL JOIN customer\n    WHERE name = 'Peter Pan');"),
        P("tak6", "2.3 ... more than once",
          "SELECT itemId, description FROM foodItem\nWHERE itemId NOT IN (SELECT itemId\n    FROM orderline NATURAL JOIN foodOrder NATURAL JOIN customer\n    WHERE name = 'Peter Pan'\n    GROUP BY itemId, custNo\n    HAVING count(*) > 1);"),
        P("tak7", "3.3 Total spend per customer",
          "SELECT custNo, (\n    SELECT sum(unitPrice * quantity)\n    FROM FoodOrder NATURAL JOIN Orderline\n    WHERE custNo = Customer.custNo) AS total_cost\nFROM Customer;",
          original="drop function if exists total_cost_for_customer;\ncreate function\ntotal_cost_for_customer(v_custNo int) returns int\nreturn\n  (select sum(unitPrice * quantity)\n  from FoodOrder natural join Orderline\n  where custNo = v_custNo);\n\nselect custNo, total_cost_for_customer(custNo) as total_cost from Customer;",
          note="Adapted: the MariaDB stored function inlines as a correlated subquery."),
    ],
    "busservice": [
        P("bus1", "1.1 Every trip",
          "SELECT tripID\nFROM Trip;"),
        P("bus2", "1.2 Trips with their passengers (empty trips too)",
          "SELECT tripID, CNO\nFROM Trip NATURAL LEFT JOIN TripPassengers;"),
        P("bus3", "1.3 Passenger counts per trip",
          "SELECT tripID, count(CNO) AS count_passengers\nFROM Trip NATURAL LEFT JOIN TripPassengers\nGROUP BY tripID;"),
        P("bus4", "2.1 Customers who never rode",
          "SELECT CNO\nFROM Customer\nWHERE CNO NOT IN (\n    SELECT CNO\n    FROM TripPassengers);"),
        P("bus5", "2.2 Never rode to station DK001",
          "SELECT CNO\nFROM Customer\nWHERE CNO NOT IN (\n    SELECT CNO\n    FROM TripPassengers NATURAL JOIN Trip\n    WHERE toStation = 'DK001');"),
        P("bus6", "2.3 Never rode to Copenhagen at all",
          "SELECT CNO\nFROM Customer\nWHERE CNO NOT IN (\n    SELECT CNO\n    FROM TripPassengers NATURAL JOIN Trip JOIN Station ON toStation = stationID\n    WHERE city = 'Copenhagen');"),
        P("bus7", "3.1 The guard trigger (adapted to SQLite)",
          "DROP TRIGGER IF EXISTS Trip_Before_Insert;\nCREATE TRIGGER Trip_Before_Insert\nBEFORE INSERT ON Trip FOR EACH ROW\nWHEN NEW.fromStation = NEW.toStation\nBEGIN\n    SELECT RAISE(ABORT, 'fromStation and toStation must be different');\nEND;",
          original="DROP TRIGGER IF EXISTS  Trip_Before_Insert;\nDELIMITER $$\nCREATE TRIGGER Trip_Before_Insert\nBEFORE INSERT ON Trip  FOR EACH ROW\nIF NEW.fromStation = NEW.toStation\nTHEN  SIGNAL SQLSTATE 'HY000' SET MYSQL_ERRNO = 1525,\n      MESSAGE_TEXT = 'fromStation and toStation must be different';\nEND IF;\n$$\nDELIMITER ;",
          note="Adapted: MariaDB's SIGNAL becomes SQLite's RAISE(ABORT). Run it, then try the next preset."),
        P("bus8", "3.3 The insert that trips the trigger",
          "INSERT INTO\nTrip(tripID, depDate, depTime, duration, fromStation, toStation, busLicensePlate)\nVALUES ('BusDK999', '2023-09-01', '10:00:00', '00:30:00', 'DK001', 'DK001', 'DS45678');",
          note="Errors ON PURPOSE once the trigger from 3.1 is installed; that abort is the answer.",
          expectError=True),
    ],
    "bikeshop": [
        P("bike1", "Insert a new customer",
          "INSERT INTO Customer VALUES ('123045-0697', 'testdummy@hotmail.com', '+45 99 23 44 02', 'Tester Dumminus');",
          original="INSERT Customer VALUES ('1230450697', 'testdummy@hotmail.com', '+45 99 23 44 02', 'Tester Dumminus');",
          note="Adapted: SQLite requires INSERT INTO (MariaDB tolerates the bare INSERT)."),
        P("bike2", "Insert a new bike",
          "INSERT INTO Bike VALUES ('B008', 'Mountain', 3, 6.5, 26);",
          original="INSERT Bike VALUES ('B008', 'Mountin', '3', '6.5', '26');"),
        P("bike3", "Insert the repair job",
          "INSERT INTO Repair_Jobs VALUES ('P008', '1/12/2026', 2, 1500, '123045-0697', 'B008', 5);",
          original="INSERT Repair Jobs VALUES ('1/12/2026', '2', '1500', '1230450697', 'B008', 'P008', '5');",
          note="The original wrote the table name with a space and the id mid-row; reconstructed column order puts repair_id first."),
        P("bike4", "Parts used on the job",
          "INSERT INTO Parts_Used VALUES ('P008', 'P108'), ('P008', 'P103'), ('P008', 'P102'), ('P008', 'P109'), ('P008', 'P101');"),
        P("bike5", "Insert the new part",
          "INSERT INTO Parts VALUES ('P108', 'Front Basket', 200, 'Kildemose');"),
        P("bike6", "Link ownership + compatibility",
          "INSERT INTO Owns VALUES ('123045-0697', 'B008');\nINSERT INTO Compatible VALUES ('P108', 'B008');"),
        P("bike7", "Update the customer's email",
          "UPDATE Customer\nSET email = 'tester.dumminus@gmail.com'\nWHERE customer_id = '123045-0697';"),
        P("bike8", "Update the repair cost",
          "UPDATE Repair_Jobs\nSET cost = 1650\nWHERE repair_id = 'P008';"),
        P("bike9", "Update the part price",
          "UPDATE Parts\nSET price = 225\nWHERE part_id = 'P108';"),
        P("bike10", "Delete the part",
          "DELETE FROM Parts\nWHERE part_id = 'P108';",
          note="Parts_Used still references P108 - with foreign keys enforced this would be refused; MariaDB's default here let it slide. Toggle FK enforcement in the panel to see both."),
    ],
}

DB_ORDER = ["university", "family", "cinema", "takeaway", "busservice", "bikeshop"]


def prep_meta_json():
    schemas = {"order": DB_ORDER, "schemas": SCHEMAS}
    with open(os.path.join(OUT, "schemas.json"), "w") as f:
        json.dump(schemas, f)
    with open(os.path.join(OUT, "presets.json"), "w") as f:
        json.dump({"order": DB_ORDER, "presets": PRESETS}, f)
    n = sum(len(v) for v in PRESETS.values())
    print("schemas.json (%d schemas) + presets.json (%d presets) written" % (len(SCHEMAS), n))


# ------------------------------------------------------------- images

def prep_images():
    jobs = [
        ("Meeting room database design.png", "er-meeting-room.webp"),
        ("News Items database design.png", "er-news-items.webp"),
        ("Data Sheet.png", "data-sheet.webp"),
    ]
    for src, dst in jobs:
        im = Image.open(os.path.join(RAW, src)).convert("RGB")
        if im.width > 1600:
            im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
        p = os.path.join(OUT, dst)
        im.save(p, "WEBP", quality=86, method=6)
        print("image %s %d KB" % (dst, os.path.getsize(p) // 1024))


# ------------------------------------------------------------- sources

def prep_sources():
    os.makedirs(SRC_DIR, exist_ok=True)
    files = [
        "UniversityDB.sql", "FamilyDB.sql", "cinema.sql", "week3.sql", "week4.sql",
        "answers.sql", "w12_part1_database.sql", "w12_part1_answers_complete.sql",
        "w13_part1_database.sql", "w13_part1_answers_complete.sql", "Data Modification.sql",
    ]
    for name in files:
        body = read_raw(name).replace(STUDENT_ID, "s******")
        out = os.path.join(SRC_DIR, name.replace(" ", "_"))
        with open(out, "w", encoding="utf-8", newline="\n") as f:
            f.write(body)
    print("sources vendored: %d files (student ID scrubbed)" % len(files))


# ------------------------------------------------------------- fixture

def split_statements(sql):
    """Split on ; but keep trigger bodies (BEGIN...END;) whole."""
    parts, cur = [], ""
    for piece in sql.split(";"):
        cur += piece + ";"
        if sqlite3.complete_statement(cur):
            if cur.strip().strip(";"):
                parts.append(cur)
            cur = ""
    if cur.strip().strip(";"):
        parts.append(cur)
    return parts


def run_preset(con, preset):
    cur = con.cursor()
    cols, rows = [], []
    for stmt in split_statements(preset["sql"]):
        cur.execute(stmt)
        if cur.description:
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
    return cols, rows


def prep_fixture():
    os.makedirs(FIX_DIR, exist_ok=True)
    fixture = {}
    for db in DB_ORDER:
        path = os.path.join(OUT, "db", db + ".sqlite")
        results = {}
        for preset in PRESETS[db]:
            con = sqlite3.connect(path)  # fresh copy semantics per preset
            con.isolation_level = None
            con.execute("BEGIN")
            try:
                # bikeshop presets build on each other: replay predecessors first
                if db == "bikeshop":
                    for prev in PRESETS[db]:
                        if prev["id"] == preset["id"]:
                            break
                        for stmt in split_statements(prev["sql"]):
                            con.execute(stmt)
                if db == "busservice" and preset["id"] == "bus8":
                    for stmt in split_statements(PRESETS[db][6]["sql"]):
                        con.execute(stmt)
                cols, rows = run_preset(con, preset)
                results[preset["id"]] = {
                    "columns": cols,
                    "rows": [[v for v in r] for r in rows],
                    "rowCount": len(rows),
                }
            except sqlite3.Error as e:
                if preset.get("expectError"):
                    results[preset["id"]] = {"error": True, "message": str(e)}
                else:
                    raise RuntimeError("preset %s failed: %s" % (preset["id"], e))
            finally:
                con.execute("ROLLBACK")
                con.close()
        fixture[db] = results
        n_err = sum(1 for r in results.values() if r.get("error"))
        print("fixture %s: %d presets (%d expected errors)" % (db, len(results), n_err))
    with open(os.path.join(FIX_DIR, "sql-presets.json"), "w") as f:
        json.dump(fixture, f)
    print("fixture sql-presets.json written")


ONLY = os.environ.get("SQL_PREP_ONLY", "").split(",") if os.environ.get("SQL_PREP_ONLY") else None
STEPS = [("dbs", prep_dbs), ("meta", prep_meta_json), ("images", prep_images),
         ("sources", prep_sources), ("fixture", prep_fixture)]
for name, fn in STEPS:
    if ONLY and name not in ONLY:
        continue
    fn()
print("sql prep done")
