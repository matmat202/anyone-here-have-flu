# Anyone here have flu?

The chance that at least one person in a room of N people in California is contagious with
flu this week — guess first, then see it.

**https://matmat202.github.io/anyone-here-have-flu/**

CDC FluView surveillance (California) gives positivity and doctor-visit shares, not "share
of people contagious now", so `model.py` converts one to the other with a factor calibrated
per past season (`calib.py`), and the page shows the central estimate with its range. The
odds for a room of k people are 1 − (1 − p)^k.

**[The story](https://matmat202.github.io/anyone-here-have-flu/story/)** (`story/`) puts this
autumn's test positivity against the same week of every season since 2016-17, with two checks
on the comparison: how much early reports get revised (Delphi's first-report issue), and how
big a same-week "record" gets by chance (leave one season out). `build_story.py` makes
`story/story.json` from `data/`; `test/story.test.mjs` pins every data-dependent sentence.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
