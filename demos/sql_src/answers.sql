-- In next line, insert your student ID after the colon.
-- Student ID: s******

-- Below, you must at most make one SQL query for each question. If you make several, they will be ignored.

-- -----------------------------------------------------------------------------------------------------
-- q1: Answer to question 1.1 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
select tid
from ticket
where price > 120;
-- -----------------------------------------------------------------------------------------------------
-- q2: Answer to question 1.2 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
select tid
from ticket natural join projection natural join movie
where genre = "Sci-Fi";
-- -----------------------------------------------------------------------------------------------------
-- q3: Answer to question 1.3 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
select tid
from ticket natural join projection natural join movie natural join room
where genre = "Sci-Fi" and mid not in(
	select mid from projection natural join room where rname = "Ruby");
-- -----------------------------------------------------------------------------------------------------
-- q4: Answer to question 2.1 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
select mid, title, genre, sum(price) as income
from movie natural join projection natural join ticket
group by mid;
-- -----------------------------------------------------------------------------------------------------
-- q5: Answer to question 2.2 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
drop view if exists incomeview; -- just creating a view here (not a separate query, just for set simplicity)
Create view incomeview as
select mid, title, genre, sum(price) as income
from movie natural join projection natural join ticket
group by mid;
set @aveinc = (Select avg(income) from incomeview);
select mid, title, genre, income
from incomeview
group by mid
having income > @aveinc;
-- using a view and variable is really convienient to not have to re-write the joint set needed to query each time
-- (see next problem to see how view simplifies future queries)
-- -----------------------------------------------------------------------------------------------------
-- q6: Answer to question 2.3 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
select mid, title, genre, income 
from incomeview as i1
where income >= (Select avg(income) from incomeview as i2 where i1.genre = i2.genre);

-- -----------------------------------------------------------------------------------------------------
-- q7: Answer to question 3.1 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
drop function if exists reservedSeats;
create function
reservedSeats(ridn int(3), pdaten date) returns int
return
	(Select count(tid) as reservations
    from Projection natural join ticket
    where rid = ridn and pdate = pdaten);
    
    
-- -----------------------------------------------------------------------------------------------------
-- q8: Answer to question 3.2 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
Select rid, reservedSeats(rid, pdate) as reserved_seats
from projection where pdate = '2025-12-19';
-- -----------------------------------------------------------------------------------------------------
-- q9: Answer to question 3.3 MUST follow below. (don't edit this line)
-- -----------------------------------------------------------------------------------------------------
Select pid, count(sno)-reservedSeats(rid, pdate) as empty_seats
from projection natural join seat
group by pid;
