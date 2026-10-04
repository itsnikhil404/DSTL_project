// ============================================================
// K-MAP ANALYZER (corrected)
// Supports 2, 3 and 4 variable SOP minimization
// ============================================================

// ---------- 1. HTML elements ----------
const variableCount = document.getElementById("variableCount");
const mintermsInput = document.getElementById("minterms");
const dontcaresInput = document.getElementById("dontcares");

const generateBtn = document.getElementById("generateBtn");
const resetBtn = document.getElementById("resetBtn");
const copyBtn = document.getElementById("copyBtn");
const themeBtn = document.getElementById("themeBtn");

const kmapContainer = document.getElementById("kmapContainer");
const truthTableContainer = document.getElementById("truthTableContainer");
const expressionBox = document.getElementById("expressionBox");
const stepsPanel = document.getElementById("stepsPanel");

// ---------- 2. State ----------
let currentMinterms = [];
let currentDontCares = [];
let currentVariables = 4;
let currentGroups = [];

// ---------- 3. Event listeners ----------
themeBtn.addEventListener("click", function () {
    document.body.classList.toggle("light");
    themeBtn.innerHTML = document.body.classList.contains("light")
        ? "☀️ Theme"
        : "🌙 Theme";
});

generateBtn.addEventListener("click", generateKMap);
resetBtn.addEventListener("click", resetAll);

copyBtn.addEventListener("click", function () {
    const text = expressionBox.innerText;

    function fallbackCopy() {
        // Works on non-HTTPS pages / older browsers
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        alert(ok ? "Expression copied!" : "Could not copy expression.");
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(function () { alert("Expression copied!"); })
            .catch(fallbackCopy);
    } else {
        fallbackCopy();
    }
});

[mintermsInput, dontcaresInput].forEach(function (input) {
    input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") generateKMap();
    });
});

// ---------- 4. Parse input ----------
// FIX: invalid tokens (letters, decimals, negatives, "0x3", "1e1")
// were silently ignored or wrongly accepted by Number().
// Now only plain non-negative integers are accepted and bad
// tokens are reported back to the user.
function parseInput(text) {
    const values = [];
    const invalid = [];

    text.split(/[\s,]+/).forEach(function (token) {
        if (token === "") return;
        if (/^\d+$/.test(token)) values.push(Number(token));
        else invalid.push(token);
    });

    return { values: [...new Set(values)], invalid: invalid };
}

// ---------- 5. Main generate ----------
function generateKMap() {
    const variables = Number(variableCount.value);
    const maxMinterm = Math.pow(2, variables) - 1;

    const m = parseInput(mintermsInput.value);
    const d = parseInput(dontcaresInput.value);

    const bad = m.invalid.concat(d.invalid);
    if (bad.length > 0) {
        alert("Invalid entries: " + bad.join(", ") +
              "\nUse whole numbers separated by commas.");
        return;
    }

    const outOfRange = m.values.concat(d.values).filter(function (x) {
        return x > maxMinterm;
    });
    if (outOfRange.length > 0) {
        alert("Out of range: " + outOfRange.join(", ") +
              ". Maximum allowed is " + maxMinterm);
        return;
    }

    const overlap = m.values.filter(function (x) {
        return d.values.includes(x);
    });
    if (overlap.length > 0) {
        alert("A minterm cannot also be a don't-care: " + overlap.join(", "));
        return;
    }

    currentVariables = variables;
    currentMinterms = m.values.sort(function (a, b) { return a - b; });
    currentDontCares = d.values.sort(function (a, b) { return a - b; });

    createMap(currentVariables, currentMinterms, currentDontCares);
    createTruthTable(currentVariables, currentMinterms, currentDontCares);

    const result = minimizeBooleanFunction(
        currentVariables, currentMinterms, currentDontCares
    );

    currentGroups = result.groups;
    expressionBox.innerHTML = "F = " + result.expression;

    displaySteps(result, currentVariables);
    highlightGroups(result.groups);
}

// ---------- 6. Gray code ----------
function grayCode(bits) {
    if (bits === 0) return [""];
    if (bits === 1) return ["0", "1"];

    const previous = grayCode(bits - 1);
    const result = [];

    for (let i = 0; i < previous.length; i++) result.push("0" + previous[i]);
    for (let i = previous.length - 1; i >= 0; i--) result.push("1" + previous[i]);

    return result;
}

// ---------- 7. Create K-map ----------
function createMap(variables, minterms, dontcares) {
    kmapContainer.innerHTML = "";

    let rowBits, colBits;
    if (variables === 2) { rowBits = 1; colBits = 1; }
    else if (variables === 3) { rowBits = 1; colBits = 2; }
    else { rowBits = 2; colBits = 2; }

    const rowCodes = grayCode(rowBits);
    const colCodes = grayCode(colBits);

    // FIX: the corner label said "AB / CD" for 3 variables.
    const rowNames = "ABCD".slice(0, rowBits);
    const colNames = "ABCD".slice(rowBits, variables);

    const wrapper = document.createElement("div");
    wrapper.className = "kmap-wrapper";

    const grid = document.createElement("div");
    grid.className = "kmap-grid";
    grid.style.gridTemplateColumns = `repeat(${colCodes.length + 1}, 1fr)`;

    const corner = document.createElement("div");
    corner.className = "kmap-cell";
    corner.innerHTML = rowNames + " / " + colNames;
    grid.appendChild(corner);

    colCodes.forEach(function (code) {
        const header = document.createElement("div");
        header.className = "kmap-cell";
        header.style.fontWeight = "bold";
        header.innerHTML = code;
        grid.appendChild(header);
    });

    for (let r = 0; r < rowCodes.length; r++) {
        const rowHeader = document.createElement("div");
        rowHeader.className = "kmap-cell";
        rowHeader.style.fontWeight = "bold";
        rowHeader.innerHTML = rowCodes[r];
        grid.appendChild(rowHeader);

        for (let c = 0; c < colCodes.length; c++) {
            const minterm = parseInt(rowCodes[r] + colCodes[c], 2);

            const cell = document.createElement("div");
            cell.className = "kmap-cell";
            cell.dataset.minterm = minterm;

            if (minterms.includes(minterm)) {
                cell.classList.add("active");
                cell.innerHTML = `<strong>${minterm}</strong><br>1`;
            } else if (dontcares.includes(minterm)) {
                cell.classList.add("dc");
                cell.innerHTML = `<strong>${minterm}</strong><br>X`;
            } else {
                cell.innerHTML = `<strong>${minterm}</strong><br>0`;
            }

            grid.appendChild(cell);
        }
    }

    wrapper.appendChild(grid);
    kmapContainer.appendChild(wrapper);

    const info = document.createElement("p");
    info.style.marginTop = "15px";
    info.innerHTML =
        `<strong>Gray Code Order:</strong> ${rowNames}: ${rowCodes.join(" , ")}` +
        ` × ${colNames}: ${colCodes.join(" , ")}`;
    kmapContainer.appendChild(info);
}

// ---------- 8. Helpers ----------
function toBinary(number, variables) {
    return number.toString(2).padStart(variables, "0");
}

function countLiterals(pattern) {
    let count = 0;
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] !== "-") count++;
    }
    return count;
}

// ---------- 9. All cubes (3^n patterns of 0 / 1 / -) ----------
function generateAllCubes(variables) {
    const cubes = [];

    function build(position, pattern) {
        if (position === variables) {
            cubes.push(pattern);
            return;
        }
        build(position + 1, pattern + "0");
        build(position + 1, pattern + "1");
        build(position + 1, pattern + "-");
    }

    build(0, "");
    return cubes;
}

// ---------- 10. Cells covered by a cube ----------
function getCoveredMinterms(cube, variables) {
    const covered = [];
    const total = Math.pow(2, variables);

    for (let number = 0; number < total; number++) {
        const binary = toBinary(number, variables);
        let matches = true;

        for (let i = 0; i < variables; i++) {
            if (cube[i] !== "-" && cube[i] !== binary[i]) {
                matches = false;
                break;
            }
        }
        if (matches) covered.push(number);
    }

    return covered;
}

// ---------- 11. Valid implicants ----------
// A cube is valid if every cell it covers is a 1 or an X,
// and it covers at least one real minterm.
function findValidImplicants(variables, minterms, dontcares) {
    const allowed = new Set([...minterms, ...dontcares]);
    const mintermSet = new Set(minterms);
    const implicants = [];

    generateAllCubes(variables).forEach(function (cube) {
        const covered = getCoveredMinterms(cube, variables);

        if (!covered.every(function (x) { return allowed.has(x); })) return;

        const realCovered = covered.filter(function (x) {
            return mintermSet.has(x);
        });
        if (realCovered.length === 0) return;

        implicants.push({
            pattern: cube,
            covered: covered,        // all cells (1s and Xs)
            minterms: realCovered,   // only real 1s
            literals: countLiterals(cube)
        });
    });

    return implicants;
}

// ---------- 12. Prime implicants ----------
// FIX: the old test compared only real minterms + literal count, which
// could discard true primes (e.g. a group that reaches a don't-care
// the larger group does not contain). A prime implicant is a valid
// cube that is NOT strictly contained in another valid cube, so we
// compare the full set of covered cells.
function findPrimeImplicants(implicants) {
    return implicants.filter(function (a) {
        return !implicants.some(function (b) {
            return b !== a &&
                b.covered.length > a.covered.length &&
                a.covered.every(function (x) { return b.covered.includes(x); });
        });
    });
}

function findEssentialPrimes(primes, minterms) {
    const essential = [];

    minterms.forEach(function (m) {
        const owners = primes.filter(function (p) {
            return p.minterms.includes(m);
        });
        if (owners.length === 1 && !essential.includes(owners[0])) {
            essential.push(owners[0]);
        }
    });

    return essential;
}

// ---------- 13. Best cover (branch & bound) ----------
// Prefers fewer terms, then fewer literals.
// FIX: added pruning so the search no longer explores all 2^n subsets.
function findBestCover(primes, minterms) {
    if (minterms.length === 0) return [];

    const sorted = [...primes].sort(function (a, b) {
        return (b.minterms.length - a.minterms.length) ||
               (a.literals - b.literals);
    });

    const targetSize = minterms.length;
    let best = null;

    function search(index, selected, covered, literals) {
        if (covered.size === targetSize) {
            if (
                best === null ||
                selected.length < best.terms ||
                (selected.length === best.terms && literals < best.literals)
            ) {
                best = {
                    groups: [...selected],
                    terms: selected.length,
                    literals: literals
                };
            }
            return;
        }

        if (index >= sorted.length) return;
        if (best !== null && selected.length >= best.terms) return;

        const prime = sorted[index];
        const added = prime.minterms.filter(function (x) {
            return !covered.has(x);
        });

        // Option 1: take it (only if it covers something new)
        if (added.length > 0) {
            const next = new Set(covered);
            added.forEach(function (x) { next.add(x); });

            selected.push(prime);
            search(index + 1, selected, next, literals + prime.literals);
            selected.pop();
        }

        // Option 2: skip it
        search(index + 1, selected, covered, literals);
    }

    search(0, [], new Set(), 0);
    return best ? best.groups : [];
}

// ---------- 14. Complete minimization ----------
function minimizeBooleanFunction(variables, minterms, dontcares) {
    if (minterms.length === 0) {
        return {
            expression: "0",
            groups: [],
            primes: [],
            essentials: [],
            allImplicants: []
        };
    }

    // NOTE: F = 1 is handled by the normal algorithm (the cube "----"
    // is valid when every cell is 1 or X), so the map still gets
    // highlighted and don't-care-only completions work too.
    const implicants = findValidImplicants(variables, minterms, dontcares);
    const primes = findPrimeImplicants(implicants);
    const essentials = findEssentialPrimes(primes, minterms);
    const groups = findBestCover(primes, minterms);

    const expression = groups
        .map(function (g) { return patternToExpression(g.pattern, variables); })
        .join(" + ");

    return {
        expression: expression || "0",
        groups: groups,
        primes: primes,
        essentials: essentials,
        allImplicants: implicants
    };
}

// ---------- 15. Pattern -> Boolean term ----------
function patternToExpression(pattern, variables) {
    let result = "";

    for (let i = 0; i < variables; i++) {
        if (pattern[i] === "-") continue;
        result += String.fromCharCode(65 + i);
        if (pattern[i] === "0") result += "'";
    }

    return result === "" ? "1" : result;
}

// ---------- 16. Display steps ----------
function displaySteps(result, variables) {
    if (result.expression === "0") {
        stepsPanel.innerHTML =
            `<strong>Step 1:</strong> No minterms were entered.<br><br>
             <strong>Result:</strong> F = 0`;
        return;
    }

    let html = "";

    html += `<div style="margin-bottom:15px;">
        <strong>Step 1 — Input</strong><br>
        Variables: ${variables}<br>
        Minterms: ${currentMinterms.join(", ") || "None"}<br>
        Don't Cares: ${currentDontCares.join(", ") || "None"}
    </div>`;

    html += `<div style="margin-bottom:15px;"><strong>Step 2 — Binary Representation</strong><br>`;
    currentMinterms.forEach(function (m) {
        html += `${m} = ${toBinary(m, variables)}<br>`;
    });
    currentDontCares.forEach(function (d) {
        html += `${d} = ${toBinary(d, variables)} (X)<br>`;
    });
    html += "</div>";

    html += `<div style="margin-bottom:15px;"><strong>Step 3 — Prime Implicants</strong><br>`;
    result.primes.forEach(function (p) {
        const essential = result.essentials.includes(p) ? " (essential)" : "";
        html += `[${p.covered.join(", ")}] → ${patternToExpression(p.pattern, variables)}${essential}<br>`;
    });
    html += "</div>";

    html += `<div style="margin-bottom:15px;"><strong>Step 4 — Selected Groups</strong><br>`;
    result.groups.forEach(function (g, i) {
        html += `Group ${i + 1}: [${g.covered.join(", ")}] → ${patternToExpression(g.pattern, variables)}<br>`;
    });
    html += "</div>";

    html += `<div><strong>Step 5 — Final SOP</strong><br>F = ${result.expression}</div>`;

    stepsPanel.innerHTML = html;
}

// ---------- 17. Highlight groups ----------
// FIX: every group used the same 4px inset ring, so overlapping groups
// drew on top of each other and only the first colour was visible.
// Each additional group on the same cell now gets a wider (nested) ring.
// Groups also highlight don't-care cells they actually contain.
function highlightGroups(groups) {
    const cells = document.querySelectorAll(".kmap-cell[data-minterm]");
    const byMinterm = {};

    cells.forEach(function (cell) {
        cell.style.boxShadow = "";
        byMinterm[cell.dataset.minterm] = cell;
    });

    const colors = ["#8b5cf6", "#f43f5e", "#06b6d4", "#f97316", "#eab308", "#14b8a6"];
    const shadows = {};

    groups.forEach(function (group, g) {
        const color = colors[g % colors.length];

        group.covered.forEach(function (m) {
            if (!shadows[m]) shadows[m] = [];
            const spread = 3 * (shadows[m].length + 1);
            shadows[m].push(`inset 0 0 0 ${spread}px ${color}`);
        });
    });

    Object.keys(shadows).forEach(function (m) {
        if (byMinterm[m]) byMinterm[m].style.boxShadow = shadows[m].join(", ");
    });
}

// ---------- 18. Truth table ----------
function createTruthTable(variables, minterms, dontcares) {
    const rows = Math.pow(2, variables);
    let html = `<table class="truth-table"><tr>`;

    for (let i = 0; i < variables; i++) {
        html += `<th>${String.fromCharCode(65 + i)}</th>`;
    }
    html += `<th>F</th></tr>`;

    for (let number = 0; number < rows; number++) {
        const binary = toBinary(number, variables);
        html += "<tr>";

        for (let i = 0; i < binary.length; i++) {
            html += `<td>${binary[i]}</td>`;
        }

        let output = 0;
        if (minterms.includes(number)) output = 1;
        else if (dontcares.includes(number)) output = "X";

        html += `<td><strong>${output}</strong></td></tr>`;
    }

    html += "</table>";
    truthTableContainer.innerHTML = html;
}

// ---------- 19. Reset ----------
function resetAll() {
    mintermsInput.value = "";
    dontcaresInput.value = "";
    variableCount.value = "4";

    currentMinterms = [];
    currentDontCares = [];
    currentGroups = [];

    kmapContainer.innerHTML =
        `<div class="placeholder">Generate a map to begin</div>`;
    truthTableContainer.innerHTML =
        `<div class="placeholder">Truth table will appear here</div>`;
    expressionBox.innerHTML = "F = —";
    stepsPanel.innerHTML = "Waiting for input...";
}

// ---------- 20. Initial state ----------
resetAll();