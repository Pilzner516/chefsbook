At the end of every Claude Code session, run this wrap-up sequence:

1. SUMMARIZE THIS SESSION
   Review what was built, fixed, or changed in this session.
   Create a bullet list of completed items in this format:
   - [YYYY-MM-DD] Brief description of what was done

2. UPDATE DONE.md
   - Check if DONE.md exists in the project root
   - If it does not exist: create it with this header:
     # DONE.md - Completed Features & Changes
     # Updated automatically at every Claude Code session wrap.
   - Append today's completed items to the TOP of the file 
     (newest first), under a date header:
     ## YYYY-MM-DD
     - Item 1
     - Item 2
   - Do not remove any existing entries
   - Keep entries concise (one line each)

3. UPDATE CLAUDE.md
   - Update the LAST SESSION section with what was done today
   - Update the NEXT SESSION section with what comes next
   - Update any KEY DECISIONS that were made
   - Update any KNOWN ISSUES that were discovered or fixed

4. UPDATE STATUS.md in bob-hq
   - Read C:\Users\seblu\aiproj\bob-hq\STATUS.md
   - Find this project's section
   - Update the Last: field with today's date and a summary
   - Update the Next: field with the next priority items
   - Update Blockers: if anything changed
   - Write the updated STATUS.md back to bob-hq

5. GIT COMMIT & PUSH
   Run these commands:
   git add DONE.md CLAUDE.md
   git commit -m "wrap: [brief description of today's session]"
   git push

   Then commit STATUS.md to bob-hq:
   cd C:\Users\seblu\aiproj\bob-hq
   git add STATUS.md
   git commit -m "status: update [project name] [date]"
   git push
   cd back to the project directory

6. CONFIRM COMPLETION
   Output a summary:
   "✓ Session wrapped:
   - X items added to DONE.md
   - CLAUDE.md updated
   - STATUS.md updated
   - Committed and pushed"
   
   Then list the items added to DONE.md so the user can verify.
