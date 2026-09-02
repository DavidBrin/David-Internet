-- In next line, insert your student ID after the colon.
-- Student ID: 

-- Below, you must at most make one SQL command for each question. If you make several, they will be ignored.

-------------------------------------------------------------------------------------------------------
-- q1.1: Answer to question 1.1 MUST follow below. (don't edit this line)
-------------------------------------------------------------------------------------------------------
-- Write an SQL query, which returns a table containing, for each food category, its catId and catName

select catId, catName
from FoodCategory

-------------------------------------------------------------------------------------------------------
-- q1.2: Answer to question 1.2 MUST follow below. (don't edit this line)
-------------------------------------------------------------------------------------------------------
-- Modify the previous SQL query to return a table containing, for each row, the catId, catName, itemId
-- and unitPrice of the food item belonging to that food category. The catId and catName of food
-- categories with no items should also be returned.
select catId, catName, itemId, unitPrice
from FoodCategory natural left join FoodItem 

-------------------------------------------------------------------------------------------------------
-- q1.3: Answer to question 1.3 MUST follow below. (don't edit this line)
-------------------------------------------------------------------------------------------------------
-- Modify the previous SQL query to return a table containing, for each food category, its catId,
-- catName and the highest unitPrice of all the food items that belong to that food category. For the
-- highest unitPrice, use attribute name highest_price
select catId, catName, max(unitPrice) as highest_price
from FoodCategory natural left join FoodItem 
group by catId;


-------------------------------------------------------------------------------------------------------
-- q2.1: Answer to question 2.1 MUST follow below. (don't edit this line)
-------------------------------------------------------------------------------------------------------
-- Write an SQL query, which returns a table containing the itemId and description of food items that 
-- have never been ordered. 
select itemId, description from foodItem 
where itemId not in (select itemId from orderline);

-------------------------------------------------------------------------------------------------------
-- q2.2: Answer to question 2.2 MUST follow below. (don't edit this line)
-------------------------------------------------------------------------------------------------------
-- Modify the previous SQL query to return a table containing the itemId and description of food items 
-- that have never been ordered by Peter Pan. 
select itemId, description from foodItem 
where itemId not in (select itemId 
	from orderline natural join foodOrder natural join customer
	where name = 'Peter Pan');

-------------------------------------------------------------------------------------------------------
-- q2.3: Answer to question 2.3 MUST follow below. (don't edit this line)
-------------------------------------------------------------------------------------------------------
-- Modify the previous SQL query to return a table containing the itemId and description of food items 
-- that have never been ordered by Peter Pan more than once. 
select itemId, description from foodItem 
where itemId not in (select itemId 
	from orderline natural join foodOrder natural join customer
	where name = 'Peter Pan'
	group by itemId, custNo
	having count(*) > 1);

-------------------------------------------------------------------------------------------------------
-- q3.1: Answer to question 3.1 MUST follow below. (don't edit this line)
-------------------------------------------------------------------------------------------------------
drop function if exists total_cost_for_customer;
create function
total_cost_for_customer(v_custNo int) returns int
return 
  (select sum(unitPrice * quantity) 
  from FoodOrder natural join Orderline 
  where custNo = v_custNo);

-------------------------------------------------------------------------------------------------------
-- q3.2: Answer to question 3.2 MUST follow below. (don't edit this line)
-------------------------------------------------------------------------------------------------------
drop function if exists total_cost_for_customer;
create function
total_cost_for_customer(v_custNo int) returns int
return 
  (select sum(unitPrice * quantity) 
  from FoodOrder natural join Orderline 
  where custNo = v_custNo);

-------------------------------------------------------------------------------------------------------
-- q3.3: Answer to question 3.3 MUST follow below. (don't edit this line)
-------------------------------------------------------------------------------------------------------

select custNo, total_cost_for_customer(custNo) as total_cost from Customer;
