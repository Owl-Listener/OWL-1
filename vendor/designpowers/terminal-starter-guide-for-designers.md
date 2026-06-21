# Terminal Starter Guide for Designers

*Everything you need to get into the terminal and meet AI agents — plus a few things to try just for the joy of it.*

---

## The basics

| Command | What it does |
|---|---|
| `pwd` | Shows where you are on your file system |
| `ls` | Lists everything in your current folder |
| `cd Documents` | Moves you into the Documents folder |
| `cd ..` | Takes you up one level |
| `cd ~` | Takes you back to your home folder, wherever you are |
| `clear` | Clears the screen (nothing is deleted, just tidied) |

**The rhythm:** you ask, it answers. One command at a time.

---

## Set up your AI agent (one-time)

You only need to do this once. Choose whichever you use:

**Claude Code**
```
npm install -g @anthropic-ai/claude-code
```

**Gemini CLI**
```
npm install -g @google/gemini-cli
```

If you get a permissions error, put `sudo` at the front and enter your Mac password when asked.

---

## Get designpowers running

**1. Clone the repo** (downloads it to your computer)
```
git clone https://github.com/Owl-Listener/designpowers.git
```

**2. Move into it**
```
cd designpowers
```

**3. Start a session**

With Claude Code:
```
claude
```
With Gemini CLI:
```
gemini
```

Wait for the owl. That's the sign you're in the right place.

---

## Give it something real

Don't say hello. Say the actual problem you're sitting with.

```
I'm designing onboarding for a health app. My users are people 
who've had a difficult diagnosis. I want to understand what they 
need before I write a single word of copy.
```

```
I have two directions for a dashboard redesign and I can't decide 
which one is more honest.
```

```
I want to chat with the motion designer directly. 
I'm after something specific.
```

---

## A few more useful commands

| Command | What it does |
|---|---|
| `mkdir my-project` | Creates a new folder called my-project |
| `open .` | Opens your current folder in Finder |
| `history` | Shows every command you've typed |
| `↑ arrow key` | Cycles back through previous commands |

---

## Useful for design work specifically

**Count the words in any file.**
```
wc -w your-file.md
```
Useful if you write copy, briefs, or Substack posts in markdown. Instant word count, no app needed.

**Copy a file's contents straight to your clipboard.**
```
cat notes.txt | pbcopy
```
The entire file lands in your clipboard, ready to paste anywhere. `pbpaste` puts it back into the terminal if you need it.

**Resize an image in one command.**
```
sips -Z 800 image.png --out small.png
```
macOS built-in, nothing to install. The `800` is the maximum dimension — width or height, whichever is larger. Useful for quickly prepping assets without opening anything.

---

## Try these for the joy of it

These aren't productivity tips. They're the terminal showing you what it actually is.

**Your Mac speaks back.**
```
say "you are now in the right place"
```
Type it. Press enter. Let it land.

**Weather as art.**
```
curl wttr.in
```
Your local weather, rendered as ASCII art. Immediately beautiful, completely unexpected.

**The hidden layer.**
```
ls -la
```
Your normal `ls` command, but now with hidden files revealed. Your filesystem has a secret layer. It was always there.

**Your file structure as a tree.**
```
brew install tree
tree
```
First command installs the tool (one-time). Second command shows your entire folder structure as a visual tree. Designers love this one.

**The bridge between worlds.**
```
open .
```
Opens your current terminal location directly in Finder. Two dots, both worlds.

**A calendar, because it's satisfying.**
```
cal
```
Just a calendar. Printed in the terminal. Small and perfect.

**Star Wars in ASCII.** *(the classic)*
```
nc towel.blinkenlights.nl 23
```
Press `Ctrl + C` when you're ready to leave. Or don't.

---

## If something goes wrong

- **Nothing is happening:** press `Enter`
- **Stuck in a weird mode:** press `Escape`, then type `:q` and `Enter`  
- **Want to stop what's running:** press `Ctrl + C`
- **Terminal looks broken:** type `reset` and press `Enter`

---

*From MC Percolates — [mcpercolates.substack.com](https://mcpercolates.substack.com)*
