-- find id and name of students who didn't take course from dept

select StudID, StudName
from student
where StudID not in (Select StudID
From student natural join takes natural join course);

-- students who take at least one course
select StudID, StudName
from student natural join takes natural join course;

-- find id and name of instructors who taught in spring 2009

Select InstID, InstName
From instructor where InstID in (Select InstID
from teaches where Semester = 'Spring' and StudyYear = '2009');

-- find id and name of instructors who taught more sections than any other inst in spr 2009

-- Select InstID, InstName, Count(*) from
Select InstID, InstName, Count(*) 
From instructor natural join Teaches 
 where Semester = 'Spring' and StudyYear = '2009' 
 group by InstID
having count(*) >= ALL (Select  Count(*) 
	From instructor natural join Teaches 
	where Semester = 'Spring' and StudyYear = '2009' 
	group by InstID);
-- order by count(*) DESC limit 1;
--  where count(InstId) = max(count(InstID));

-- find id and title of the least taken courses in spring 

Select distinct CourseID, Count(*) 
From takes natural join section
where semester = "Spring" and StudyYear=2009
group by CourseID
having count(*) <= all (Select Count(*) 
	From takes natural join section
	where semester = "Spring" and StudyYear=2009
    group by CourseID);
-- answer below  
Select CourseID, Title, Count(StudID) 
From course natural join section natural left join takes  -- excludes unneeded data -- including section checks for courses with 0 students
where semester = "Spring" and StudyYear=2009
group by CourseID
having count(StudID) <= all (Select Count(StudID) 
	From section natural left join takes
	where semester = "Spring" and StudyYear=2009
    group by CourseID);   
    
    
-- find id and name of students that took more courses than average of students

drop view if exists courseTaken;
create view courseTaken (StudID, NumCourses) as
Select StudID, Count(CourseID)
from student natural left join takes
group by studID;
    
select StudID, StudName
from student natural join courseTaken
where NumCourses > (Select avg(NumCourses)
	from courseTaken);
    
-- -- find id and name of students that took more courses than average of students in the same department
select StudID, StudName, NumCourses
from student as s1 natural join courseTaken
where NumCourses > (Select avg(NumCourses)
	from courseTaken natural join student as s2
    where s1.DeptName = s2.DeptName);
    
    