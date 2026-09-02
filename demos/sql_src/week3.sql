-- Find ID

SELECT StudID, StudName 
FROM student NATURAL JOIN takes
where Grade is null;

-- find name of department and total courses 0ffered 
-- and avg creds

Select DeptName, count(*), avg(Credits)
FROM course
group by DeptName
order by avg(Credits) desc, DeptName;

-- for each stud, find id, name, num courses taken & passed

select StudID, StudName, count(CourseID), count(Grade)
from takes natural join student
group by StudID;

-- Find id and title of courses w more creds than average

Select CourseID, Title, Credits
From course where credits > (select avg(Credits) from course)
group by title; 

Select CourseID, Title, Credits
From course
group by DeptName
having Credits > avg(Credits);

Select CourseID, Title, Credits
From course as c1 
where credits > (select avg(c2.Credits) 
	from course as c2 
    where c2.DeptName = c1.DeptName)
group by title; 

-- Find id and title of courses w no prereqs 
-- natural join cuts out null entries
Select CourseID, Title
from course
 Where CourseID NOT IN(
Select CourseID
From Prereq);

Select StudName
From student 
where StudID NOT IN(
Select StudID from takes);

Select title, count(Credits)
from course 
where courseID in (Select CourseID from teaches where 
InstID in (Select InstID from instructor where
InstName = 'Brandt'));

