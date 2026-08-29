# CSE152B - Spring 2025: Homework 1
## Computing Resources

You should be assigned an account that has access to GPU clusters on https://datahub.ucsd.edu/. Steps to set up the environment:
- Login with your UCSD credentials;
- Launch a GPU instance with (4 CPU, 16G RAM, 1 GPU). This will lead you to a Jupyter Notebook GUI, where you can browse files, launch a terminal with bash environment via (upper-right) New -> Terminal.
- You can also access the container with command line from your local terminal:
    - `ssh {your ucsd id}@dsmlp-login.ucsd.edu` # use your UCSD credentials
    - get active container via `kubectl get pods`
    - attach to the pod via `kubesh {pod name you got from above}`
    - then you will be in the bash environment inside the container, identical to the terminal launched from Jupyter Notebook.
    
## Prepare the notebook and codes
Once you are in the bash environment from the terminal, pull the code for HW1 by:

```bash
cd HW1
cd pytorch-superpoint/datasets
# Link the dataset
ln -s ~/public/HPatches .
# You can download the HPatches dataset too:
# curl -L -o hpatches-sequence-release.zip  https://www.kaggle.com/api/v1/datasets/download/javidtheimmortal/hpatches-sequence-release
# Unzip the dataset into HPatches folder
# unzip hpatches-sequence-release.zip && mv hpatches-sequences-release HPatches
cd ..
```

Complete the code in [HW1.ipynb](HW1.ipynb).

## Submission Instructions
1. Attempt all questions.
2. Please comment all your code adequately.
3. Include all relevant information such as text answers, output images in notebook.
4. **Academic integrity:** The homework must be completed individually.

5. **Submission instructions:**  
 (a) Submit the notebook and its PDF version on Gradescope, via:
     - Option 1: Ctrl + P -> Save as PDF (toggling Headers and footers, Background graphics)
     
 (b) Rename your submission files as Lastname_Firstname.ipynb and Lastname_Firstname.pdf.  
 (c) Correctly select pages for each answer (only your answers; excluding the problem description text) on Gradescope to allow proper grading.

6. **Due date:** Assignments are due Sat Apr 19, 11.59PM PST.