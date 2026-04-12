#!/bin/bash
atq | sort -k 2,2M -k 3,3n -k 4,4 | while read id m d t y q u; do
    echo -n "[$id] $m $d $t $y $u | "
    at -c "$id" | tail -n 2 | head -n 1
done
