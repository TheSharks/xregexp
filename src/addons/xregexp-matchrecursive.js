// XRegExp addon: Match Recursive 0.1.1
// (c) 2009-2012 Steven Levithan
// MIT License
// <http://xregexp.com>

;var XRegExp;

if (!XRegExp) {
    throw new ReferenceError("XRegExp must be loaded before Match Recursive");
}

/* accepts a string to search, left and right delimiters as regex pattern strings, optional regex
flags (may include non-native s, x, and y flags), and an options object which allows setting an
escape character and changing the return format from an array of matches to a two-dimensional array
of string parts with extended position data. returns an array of matches (optionally with extended
data), allowing nested instances of left and right delimiters. use the g flag to return all
matches, otherwise only the first is returned. if delimiters are unbalanced within the subject
data, an error is thrown.

known issues:
- backreferences are not supported within delimiter patterns when using `escapeChar`. */

XRegExp.matchRecursive = function (str, left, right, flags, options) {
    "use strict";

    var options = options || {},
        escapeChar = options.escapeChar,
        vN = options.valueNames,
        flags = flags || "",
        global = flags.indexOf("g") > -1,
        sticky = flags.indexOf("y") > -1,
        flags = flags.replace(/y/g, ""), // flag y handled internally; can be used even if not supported natively
        left = new XRegExp(left, flags),
        right = new XRegExp(right, flags),
        output = [],
        openTokens = 0, delimStart = 0, delimEnd = 0, lastOuterEnd = 0,
        outerStart, innerStart, leftMatch, rightMatch, escaped, esc;

    if (escapeChar) {
        if (escapeChar.length > 1)
            throw new SyntaxError("can't supply more than one escape character");
        escaped = XRegExp.escape(escapeChar);
        esc = new RegExp(
            "(?:" + escaped + "[\\S\\s]|(?:(?!" + left.source + "|" + right.source + ")[^" + escaped + "])+)+",
            flags.replace(/[^im]+/g, "") // flags g, y, s, and x aren't needed here (s and x are handled by XRegExp)
        );
    }

    while (true) {
        // if using an escape character, advance to the next delimiter's starting position,
        // skipping any escaped characters
        if (escapeChar)
            delimEnd += (XRegExp.exec(str, esc, delimEnd, /*anchored*/ true) || [""])[0].length;

        leftMatch = XRegExp.exec(str, left, delimEnd);
        rightMatch = XRegExp.exec(str, right, delimEnd);

        // only keep the result which matched earlier in the string
        if (leftMatch && rightMatch) {
            if (leftMatch.index <= rightMatch.index)
                rightMatch = null;
            else
                leftMatch = null;
        }

        // paths*:
        // leftMatch | rightMatch | openTokens | result
        // 1         | 0          | 1          | ...
        // 1         | 0          | 0          | ...
        // 0         | 1          | 1          | ...
        // 0         | 1          | 0          | throw
        // 0         | 0          | 1          | throw
        // 0         | 0          | 0          | break
        // * - does not include the sticky mode special case
        //   - the loop ends after the first completed match if not in global mode

        if (leftMatch || rightMatch) {
            delimStart = (leftMatch || rightMatch).index;
            delimEnd = delimStart + (leftMatch || rightMatch)[0].length;
        } else if (!openTokens) {
            break;
        }

        if (sticky && !openTokens && delimStart > lastOuterEnd)
            break;

        if (leftMatch) {
            if (!openTokens++) {
                outerStart = delimStart;
                innerStart = delimEnd;
            }
        } else if (rightMatch && openTokens) {
            if (!--openTokens) {
                if (vN) {
                    if (vN[0] && outerStart > lastOuterEnd)
                               output.push([vN[0], str.slice(lastOuterEnd, outerStart), lastOuterEnd, outerStart]);
                    if (vN[1]) output.push([vN[1], str.slice(outerStart,   innerStart), outerStart,   innerStart]);
                    if (vN[2]) output.push([vN[2], str.slice(innerStart,   delimStart), innerStart,   delimStart]);
                    if (vN[3]) output.push([vN[3], str.slice(delimStart,   delimEnd),   delimStart,   delimEnd]);
                } else {
                    output.push(str.slice(innerStart, delimStart));
                }
                lastOuterEnd = delimEnd;
                if (!global)
                    break;
            }
        } else {
            throw new Error("subject data contains unbalanced delimiters");
        }

        // if the delimiter matched an empty string, advance delimEnd to avoid an infinite loop
        if (delimStart === delimEnd)
            delimEnd++;
    }

    if (global && !sticky && vN && vN[0] && str.length > lastOuterEnd)
        output.push([vN[0], str.slice(lastOuterEnd), lastOuterEnd, str.length]);

    return output;
};
