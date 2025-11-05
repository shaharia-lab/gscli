# **Product Requirements Document: gdc (Google Developer CLI)**

Version: 0.1 (MVP)  
Document Status: Draft

## **1\. Introduction**

### **Problem**

Developers and power users who operate primarily from the command line lack a simple, unified, and fast tool to perform common read-only operations on their core Google services (Gmail, Drive, and Calendar). Accessing this data requires switching to a web browser, which is disruptive and non-scriptable.

### **Solution**

gdc will be a modern, command-line interface (CLI) application built with TypeScript and Bun. It will provide a single, fast, and intuitive entry point for read-only access to a user's Gmail, Google Drive, and Google Calendar data.

### **Target User**

* Developers, DevOps engineers, and power users who are comfortable in a terminal.  
* Users who want to quickly query Google services without leaving their CLI.  
* Users who may want to use gdc output in scripts (e.g., gdc calendar list | grep "1-on-1").

## **2\. MVP Goals**

* **Authentication:** Establish a secure, one-time OAuth 2.0 flow to authorize the CLI to access Google APIs on the user's behalf.  
* **Core Services:** Implement a read-only command structure for the "big three" services: gdc gmail, gdc drive, and gdc calendar.  
* **Usability:** Ensure the CLI is fast (thanks to Bun) and the commands are intuitive and discoverable.  
* **Core Functionality:** Focus on the most common read-only tasks: listing/searching emails, listing/downloading files, and listing/searching events.

## **3\. MVP Features & User Stories**

### **Feature: Authentication (Core)**

* **Story:** As a first-time user, I must be able to securely authenticate gdc with my Google account so the tool can access my data.  
* **Story:** As a returning user, I want my authentication to be stored locally and refreshed automatically so I don't have to log in every time I run a command.

### **Feature: Gmail (gdc gmail)**

* **Story:** As a user, I want to list the most recent emails from my Inbox, with the ability to limit the count.  
  * **Command:** gdc gmail list \[--limit 10\]  
* **Story:** As a user, I want to list emails from a specific folder/label (e.g., "Sent", "Drafts", "My-Project").  
  * **Command:** gdc gmail list \--folder "Sent"  
* **Story:** As a user, I want to search my entire mailbox using a simple query string.  
  * **Command:** gdc gmail search "from:boss@example.com subject:report"

### **Feature: Google Drive (gdc drive)**

* **Story:** As a user, I want to list the files and folders in my "My Drive" root.  
  * **Command:** gdc drive list  
* **Story:** As a user, I want to list the contents of a specific folder (by name or ID).  
  * **Command:** gdc drive list \--folder "Project-Docs"  
* **Story:** As a user, I want to search for files or folders by name.  
  * **Command:** gdc drive search "Q4-Budget"  
* **Story:** As a user, I want to download a file by its file-id to my current directory.  
  * **Command:** gdc drive download \<file-id\>  
* **Story:** As a user, when downloading a Google Doc, Sheet, or Slide, I want to export it as a PDF.  
  * **Command:** gdc drive download \<google-doc-id\> \--format pdf

### **Feature: Google Calendar (gdc calendar)**

* **Story:** As a user, I want to list today's events from my primary calendar.  
  * **Command:** gdc calendar list  
* **Story:** As a user, I want to list events for a relative time range, like the "next 7 days".  
  * **Command:** gdc calendar list \--range 7d  
* **Story:** As a user, I want to list events for a specific date or date range.  
  * **Command:** gdc calendar list \--start "2025-11-10" \--end "2025-11-11"  
* **Story:** As a user, I want to search for events on my calendar containing specific text.  
  * **Command:** gdc calendar search "Team Sync"

## **4\. Non-Goals (Out of Scope for MVP)**

* **Write Operations:** Absolutely no creating, deleting, or modifying data (e.g., sending email, uploading files, creating events, moving files).  
* **Complex Output Formats:** All output will be simple, human-readable text for the terminal. We will not support JSON, YAML, or complex table output in the MVP.  
* **Multi-Account Support:** The CLI will only support a single authenticated Google account at a time.  
* **Markdown Export:** While requested, Google Drive's API for Markdown export is inconsistent across file types. We will standardize on PDF export for Google Workspace files (Docs, Sheets) for the MVP due to its reliability.  
* **Configuration File:** No complex .gdcrc file. Settings will be based on command-line flags.

## **5\. Brief Technical Implementation**

* **Core:** Built with **TypeScript** and executed with **Bun**.  
* **CLI Framework:** Use a robust argument parser like commander.js or yargs to structure the gdc \<service\> \<command\> \[options\] interface.  
* **Packaging:** Use bun build to compile the TypeScript into a single, distributable executable.  
* **Authentication (OAuth 2.0):**  
  1. Register a "Desktop app" in the Google Cloud Console to get a client\_id and client\_secret.  
  2. Create an gdc auth login command. This command will:  
     a. Spin up a temporary local web server (e.g., on localhost:3000).  
     b. Print a Google authorization URL (with scopes for gmail.readonly, drive.readonly, calendar.readonly).  
     c. The user opens this URL, authenticates, and is redirected back to the localhost:3000 callback.  
     d. The local server catches the authorization code from the redirect.  
     e. The CLI exchanges this code for an access\_token and a refresh\_token.  
  3. The **refresh\_token** (which is long-lived) must be securely stored locally (e.g., in \~/.config/gdc/credentials.json).  
  4. For all subsequent API calls, the CLI will use the refresh\_token to get a new, short-lived access\_token automatically.  
* **Google API Client:**  
  * Use the official googleapis Node.js library (npm install googleapis).  
  * **Gmail API:** gmail.users.messages.list (supports labelIds for folders and q for search).  
  * **Drive API:**  
    * drive.files.list (supports q for searching by name or folder parent).  
    * drive.files.get (for standard file downloads).  
    * drive.files.export (for exporting Google Docs/Sheets as application/pdf).  
  * **Calendar API:** calendar.events.list (supports timeMin, timeMax for date ranges and q for text search).