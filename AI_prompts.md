# Assignment 4 — AI Prompts

Log of the prompts used for each problem in Assignment 4 
---

## Problem 1

### The problem number and title:

Problem 1 — Viber Coder Prompts 


### Main prompt:

Create an AI_prompts.md file root level in hw4 (where we'll be working unless I say otherwise). Create 13 sections, labelled "Problem #" replacing # with 1-13 . Each section will have subheadings 

The problem number and title: 
Main prompt: 
Follow up Prompt/Explanation: 

Please distinguish these sections and make it elligable.

---

## Problem 2

### The problem number and title:

Problem 2 — Analyze the database 

### Main prompt:

open up data/campus_customs.db and print me a table(s) I can understand to easily interpret the data. 

Also explain to me all the fields used, briefly. Especially catalogue, inventory, users

Create output/harness.md. Make a section labelled "Database" for each table create a subsection, and list down each field in the table. leave a bullet space so I can later explain why each field matters. Explain to me why each field matters.   I will be adding future information into this file, and they'll be unrealted to this so please distibguish this from other sections I add. 

---

## Problem 3

### The problem number and title:

Problem 3 —  Build the Campus Customs Website 

### Main prompt:

We're going to make a REACT + VITE + TYPE SCRIPT site, and will be hosted on git pages later. 

For now, we'll focus on building the front end. Use the portkey when applicable. Let me know each time the portkey is used. 

Site Name: "Campus Customs" 

The site will consist of 

Home 
Products 
About Us
Log In
Create account 

The site theme: 

"old money" style 
Should cater toward elite status members, but market casual and business attire
Colors: Royal Blue, White, and any other colors that mix well.



Create a top nav bar that links all these pages, and is interactive and facy when interacting with it. 

Home: 

Should be welcoming and have a bold statement. 
Use this website https://yalebulldogblue.com/ as an example of what type of wording should exist on the homepage, but switch it to the style we talked about. DO NOT COPY ANYTHING VERBITIM. 
we'll add more spice to this later. 

About us: 

Use information from https://yalebulldogblue.com/ for reference, to create artififcal locations and information that would be helpful in an about us section. DO NOT COPY ANYTHING VERBITIM. 
add info that also caters to what we talked about above

Products: 

From @Vibe Coding/Assignments/Assignment 4/data/campus_customs.db , use the image paths to show product images in a catalogue fashion, with name, price, description. This should look like an EPG, with easily browsable caraousels and visible information I mentioned before. 
Clicking on an product image should then open a single item page (the image should take up the  entire right side of the page). The left side should beautifully display description price, sizes, stock etc in a manner you would normally see on a clothing website. This should look impressive, so try hard. 

On the bottom right of the site, should be a friendly chat interface pill that reacts when you hover over it. It doesn't need to be functional yet, just something that carrys from page to page and remembers the state it was on. we'll add functinality later. 

To help with the products page, create a simple fastapi app in backend/main.py so that you can access and serve the products and images. Don't do anything else with it yet



### Follow up Prompt/Explanation:

> 

---

## Problem 4

### The problem number and title:

Problem 4 — Create account and login 

### Main prompt:

We're going to create a registration/sign ability for users. 

For registration/create account the prompts should take in the first name, last name, email, password. 
-    Do standard checks and prompt the user if they're using illegal characters
-   have them renter the password in another prompt and confirm it matches. Prompt them if it doesn't. Make it funny, but elegant. 
-   Treat users as royalty., even in your messaging to them. 

Store these new accounts in the users table in the db. Store them securly, salt them. The database already has an example of a user. Don't edit that user but make sure the existing user should also be able to login. 

For logging in, accept an email and password. They shoul dhave a nice welcome back message upon logging in. Don't display any sensative data. 


### Follow up Prompt/Explanation:

Make sure you allow for 120,000 iterations (sha256). 
> wasn't picking up previously stored test account
---

## Problem 5

### The problem number and title:

Problem 5 — PydanticAI agent backend

### Main prompt:

We'll now power the agent behind the chat widget. Update backend/main.py with a pydanticAi agent (for FastAPI). Use the portkey api to build this agent. 

backend/prompts/prompt.md will be the system prompt. 

backend/agent.py will be the agent entry and wiring 

backend/tools.py will the tools the agent can call

backend/models.py is the structured types for pydantic or pyrandanticAI

main.py should indicate the chat route for messages. When a user clicks the chat and types a message, put a faux "is typing" message while the message is being crafted. Then craft and expose the response to the user in the chat window. Follow up with prompts to the user that may help expand their questions. 

prompts.md should contain the following: The voice should be friendly, and never expose any privalleged information, passwords, or information from the user database except the username of the current username. Reword this nicely. 

models.py add types necessary for chat replies and product cards. Let me know what you add. 

harness.md. Note that the front end will talk via the fastapi to grab database information, then use the prompt and model files to reply appropraritly. Reword this nicely. 

the backend should run from the backend/ folder with a command like uvicorn main:app --reload --port 8000



### Follow up Prompt/Explanation:

> 

---

## Problem 6

### The problem number and title:

Problem 6 — Tools: product info and stock 

### Main prompt:

Give the agent a skill and tool to look up information from campus_customs.db like product description, price, how many are in stock (by size too). The agent should NOT make up information, annd clearly outline visually and to the user if something is out of stock or unavailable. 

Update prompt.md so that the agent knows to use this new tool when looking for price, stock, or similar questions. Update models.py with these new return types. 

Update harness.md and list the new tools and add that it's important that the tool reads accurate values for price, stock since those impact the users decision to buy

### Follow up Prompt/Explanation:

> 

---

## Problem 7

### The problem number and title:

Problem 7 — chat search that updates the page 

### Main prompt:

New skill/tool: If the customer asks about a specific item, the agent should be able to search the catalog db and show matching items as product cards similar to what we build already on a single item page and  Just like previously, each image click will open up the details (image on right, info on left). Just like previously, each image click will open up the details. The chat window should still be open. 

Update prompt.md with the process of getting and dyanmically loading information from the db. 

Update harness.md with the relevant info and also the fact that db calls should be one way and information inthe database shouldn't updated for product searches. 
### Follow up Prompt/Explanation:

> 

---

## Problem 8

### The problem number and title:

Problem 8 — customer memory 

### Main prompt:

new skill/tool: Chat history for a user is stored in a chat-history table (create if there isn't one). This functions so that any time a LOGGED In user uses the chat and logs out, the chat history is restored from previous sessions, or as they change pages. Reference the users name and email to get this info, but never their password. 

Non-logged in users can chat but don't have sessions saved. 

The agent should be familar with the user. 

New skill/tool: THe chat agent should be able to scan the page the user is currently on and be search and find information relavnt to the page. Eg. If the user asks "do you have this in blue", the agent should be able to check the catalog for the same item in a nother color. Use and install any libraries that you need to get this done. Don't go overboard though, take 5 minutes tops. 

In hardness.md, write how the chat history is stored, and what customer fields the agent sees, and how page context is passed, based on what I told you. 



### Follow up Prompt/Explanation:

> 

---

## Problem 9

### The problem number and title:

Problem 9 — Usabulity improvements

### Main prompt:

//Note for TA: I already added improvements along the way above but am adding more here

Make the user be able to add to a cart, and add the cart to a temp database table. Don't create a checkout funnel, but add the button. When a user clicks add to cart, an overlay should pop up, and also show users items that would go well with the item they purchased. It shouldn't be the same type of apparel (check the db). Show items that are "hot" or "almost gone". These images and items should be clickable too. 

Add "hot" or "almost gone" ribbon wherever an item is visible and fits that criteria. Read the db for that info (inventory) 

Add the ability on the product pages where a user can request to pick up an item in store. Create a popup form for the user to have them select pickup date and if someone else will be picking up instead. 


For the chat agent, quickly serch the agents memory if a question was already asked before running through portkey. If people are asking normal questions that don't need db quering or product searches, like "hi", don't use portkey until a relvant question is asked. Update prompt.md

Also, if the user asks something vauge like "show me sweaters", reply with a clarifying question before doing a db search to limit the query. Update prompt.md

Update the necessary mds. Also, create output/usability.md

### Follow up Prompt/Explanation:

> Clean up the text usability.md and make it a more enjoable read. 

---

## Problem 10

### The problem number and title:

Problem 10 — Style the website

### Main prompt:
//Note for TA: I already added improvements along the way above but am adding more here

On the product page, add moving glimmer to the "add to cart" buttons that draw users to that button. 

integrate tilt.js dimensional depth to the product cards when in a carousel. 

When a user is logged in, add more gold accents to the elements on the page. This should go away on log out. They should feel special for being members. 

Create an empty output/design.md 

### Follow up Prompt/Explanation:

remove the tilt.js from the carousels, it looks clunky. Add it to the right panel for the large image when in detail view.

---

## Problem 11

### The problem number and title:

Problem 11 — Site testing (app check)

### Main prompt:

Create output/app_check.html. 

The HTML should have have 3 headings: 
1. Inventory Level 
2. Dynamic search-result cards
3. Chat Clarifying Questions

For 1, confirm chat can check the inventory level of an item that it's a legit price/stock from the db. 

For 2, check that dynamic cards populate after the chat is asked a cateogry question "show me blue hoodie"

For 3, check that chat will ask clarifying quesions back for vague prompts. 

Each heading should be followed up with  a screenshot and a placeholder for a screenshot explanation. 

Screenshots should also be put into output/app_check_images and the paths should be used to populate app_check.html. Eg. app_check_images/inventory.png should populate that image. 



### Follow up Prompt/Explanation:

> 

---

## Problem 12

### The problem number and title:

Problem 12 — Audit trail, safety, finish harness

### Main prompt:

Add audit_trail.json and update it with agent loop activity (time, tool name, short args/result, stop reason). This does not get cleared between runs. 


In prompt.md, please ensure that the ai does not access other websites, give bad info, share private info. If a security risk is created, please note it. If a user asks something suspicious, log it.  

Ensure that harness.md already includes but don't tweak: 
model fields and why they're important
tools and abilities 
safety rules 
specs (llops llimits, result caps, models, how to run, etc.)

### Follow up Prompt/Explanation:

> 

---

## Problem 13

### The problem number and title:

Problem 13 — Push to Github and submit the URL 

### Main prompt:

Create a README.md file that explains how to run the front and end back end if someone takes this off of github. 



### Follow up Prompt/Explanation:

> 
