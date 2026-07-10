So what am I missing?

I undersstand the concept of obtaining a market from the kalshi site.

I want to go deeper than that in my concept of a tv program. 

I want a tv program to be a stateful object like a thing. Like there are 2 things about the program that are abstractable here:

- The content feed of the program itself. The stream, etc.

- How we want to percieve the program.

Each program has a different market associated with it. 

It has a:
    - title
    - start time
    - end time
    - program_event_feed []
    - buy_condition

It has a state that can be updated. For example, if a host says something, the
state of the tv program can be updated to include that information. 

I want to comprehend the way in which things are different