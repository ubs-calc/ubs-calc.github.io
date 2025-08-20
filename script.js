// ---------------------- GLOBAL VARIABLES ----------------------
let currentLuck = 1;
let potionData = null;

let totalCosts = {
    tokens: 0,
    geodes: {},
    stats: {}
};

// ---------------------- ELEMENTS ----------------------
const luckDisplay = document.getElementById("luckDisplay");
const luckInput = document.getElementById("luckInput");
const rollSpeedDisplay = document.getElementById("rollSpeedDisplay");
const rollSpeedInput = document.getElementById("rollSpeedInput");
const potionsContainer = document.getElementById("potionsContainer");
const totalContainer = document.getElementById("totalCosts");

// ---------------------- UTILITY FUNCTIONS ----------------------
function changeLuck() {
    const val = Number(luckInput.value);
    currentLuck = Number.isFinite(val) ? val : 1;
    luckDisplay.textContent = currentLuck;
}

function changeRollSpeed() {
    const val = Number(rollSpeedInput.value);
    rollSpeedDisplay.textContent = Number.isFinite(val) ? val : 1;
}

function resetTotalCosts() {
    totalCosts = { tokens: 0, geodes: {}, stats: {} };
}

function abbreviateNumber(num) {
    if (num < 1e6) return num.toString();
    const suffixes = ["M","B","T","Qa","Qn","Sx","Sp","Oc","No","De","UDe","DDe","TDe","QaDe","QiDe","SxDe","SpDe","OcDe","NDe","Vg"];
    let tier = Math.floor(Math.log10(num) / 3) - 2;
    if (tier >= suffixes.length) tier = suffixes.length - 1;
    let scale = Math.pow(1000, tier + 2);
    return (num / scale).toFixed(2) + suffixes[tier];
}

// ---------------------- DATA FETCH ----------------------
async function loadPotionData() {
    try {
        const res = await fetch('data.json');
        if (!res.ok) throw new Error('Failed to fetch JSON');
        potionData = await res.json();
        console.log("Potion data loaded:", potionData);
    } catch (e) {
        console.error(e);
    }
}

// ---------------------- CALCULATION ----------------------
function calculatePotionCosts(potionName, amount = 1) {
    const potion = potionData.potions.find(p => p.name === potionName);
    if (!potion) return null;

    const data = {
        name: potionName,
        amount,
        tokens: 0,
        geodes: {},
        stats: {},
        potions: []
    };

    // Own tokens
    potion.potions.forEach(sub => {
        if (sub.amount <= 0) return;
        if (sub.name === "nothing") {
            const tokenAmount = potion.cost * amount;
            data.tokens += tokenAmount;
            totalCosts.tokens += tokenAmount;
        } else {
            const subData = calculatePotionCosts(sub.name, sub.amount * amount);
            if (subData) {
                data.potions.push(subData);

                // Only add sub-costs to global totals
                Object.entries(subData.geodes).forEach(([k, v]) => {
                    totalCosts.geodes[k] = totalCosts.geodes[k] || { amount: 0, rarity: v.rarity, origin: v.origin };
                    totalCosts.geodes[k].amount += v.amount;
                });
                Object.entries(subData.stats).forEach(([k, v]) => {
                    totalCosts.stats[k] = (totalCosts.stats[k] || 0) + v;
                });
            }
        }
    });

    // Own geodes
    potion.geode.forEach(g => {
        if (g.amount > 0) {
            data.geodes[g.name] = { amount: g.amount * amount, rarity: g.rarity, origin: g.origin };
            totalCosts.geodes[g.name] = totalCosts.geodes[g.name] || { amount: 0, rarity: g.rarity, origin: g.origin };
            totalCosts.geodes[g.name].amount += g.amount * amount;
        }
    });

    // Own stats
    potion.stat.forEach(s => {
        if (s.amount > 0) {
            data.stats[s.name] = s.amount * amount;
            totalCosts.stats[s.name] = (totalCosts.stats[s.name] || 0) + s.amount * amount;
        }
    });

    return data;
}

// ---------------------- RENDERING COLLAPSIBLE BULLETS ----------------------
function renderPotionList(data, isSub = false) {
    const li = document.createElement('li');

    const titleSpan = document.createElement('span');
    titleSpan.innerHTML = `<strong>x${data.amount} ${data.name}</strong>`;
    li.appendChild(titleSpan);

    const ul = document.createElement('ul');
    ul.style.marginLeft = '20px';

    // Display own ingredients only
    if (data.tokens > 0) {
        const t = document.createElement('li');
        t.textContent = `x${abbreviateNumber(data.tokens)} Tokens`;
        ul.appendChild(t);
    }

    Object.entries(data.geodes).forEach(([name, obj]) => {
        const g = document.createElement('li');
        g.textContent = `x${abbreviateNumber(obj.amount)} ${name} (1/${obj.rarity})`;
        ul.appendChild(g);
    });

    Object.entries(data.stats).forEach(([k, v]) => {
        const s = document.createElement('li');
        s.textContent = `x${abbreviateNumber(v)} ${k}`;
        ul.appendChild(s);
    });

    // Render sub-potions
    data.potions.forEach(sub => {
        ul.appendChild(renderPotionList(sub, true));
    });

    li.appendChild(ul);

    // Collapsible behavior for sub-potions
    const startCollapsed = hasIngredients(data);
    if (isSub) {
        ul.style.display = 'none';
        titleSpan.style.cursor = 'pointer';
        titleSpan.style.transition = 'color 0.2s';

        titleSpan.addEventListener('mouseover', () => titleSpan.style.color = '#007BFF');
        titleSpan.addEventListener('mouseout', () => titleSpan.style.color = '');
        titleSpan.addEventListener('click', () => {
            ul.style.display = ul.style.display === 'none' ? 'block' : 'none';
        });

        if (!startCollapsed) ul.style.display = 'block';
    }

    return li;
}

function hasIngredients(boxData) {
    return Object.keys(boxData.geodes).length > 0 || Object.keys(boxData.stats).length > 0 || boxData.tokens > 0;
}

// ---------------------- DISPLAY FUNCTIONS ----------------------
function displayPotions(potionName, amount) {
    if (!potionData) return;
    potionsContainer.innerHTML = '';
    resetTotalCosts();

    const mainData = calculatePotionCosts(potionName, amount);
    if (!mainData) return;

    const ul = document.createElement('ul');
    ul.appendChild(renderPotionList(mainData));
    potionsContainer.appendChild(ul);

    displayTotalCosts();
}

function displayTotalCosts() {
    totalContainer.innerHTML = '<h2>Total Costs</h2>';

    // Tokens
    const tokenHeader = document.createElement('h3');
    tokenHeader.textContent = 'Tokens';
    totalContainer.appendChild(tokenHeader);

    const tokenUl = document.createElement('ul');
    const liTokens = document.createElement('li');
    liTokens.textContent = `x${abbreviateNumber(totalCosts.tokens)} Tokens or x${abbreviateNumber(Math.round(totalCosts.tokens*0.6))} Tokens (discounted)`;
    tokenUl.appendChild(liTokens);
    totalContainer.appendChild(tokenUl);

    // Geodes
    const geodeHeader = document.createElement('h3');
    geodeHeader.textContent = 'Geodes';
    totalContainer.appendChild(geodeHeader);

    const geodeUl = document.createElement('ul');
    Object.entries(totalCosts.geodes).forEach(([name, obj]) => {
        const li = document.createElement('li');
        li.textContent = `x${abbreviateNumber(obj.amount)} ${name} (1/${obj.rarity}), From ${obj.origin} Geode`;
        geodeUl.appendChild(li);
    });
    totalContainer.appendChild(geodeUl);

    // Stats
    const statsHeader = document.createElement('h3');
    statsHeader.textContent = 'Stats';
    totalContainer.appendChild(statsHeader);

    const statsUl = document.createElement('ul');
    Object.entries(totalCosts.stats).forEach(([k, v]) => {
        const li = document.createElement('li');
        li.textContent = `x${abbreviateNumber(v)} ${k}`;
        statsUl.appendChild(li);
    });
    totalContainer.appendChild(statsUl);
}


// ---------------------- BUTTON HANDLERS ----------------------
function confirmPotion() {
    const name = document.getElementById("potionNameInput").value;
    const amount = Number(document.getElementById("potionAmountInput").value);
    if (!name || isNaN(amount) || amount <= 0) {
        alert("Enter valid potion name & amount");
        return;
    }
    displayPotions(name, amount);
}

// ---------------------- EVENTS ----------------------
document.addEventListener('DOMContentLoaded', loadPotionData);
document.getElementById("confirmLuck").addEventListener("click", changeLuck);
document.getElementById("confirmRollSpeed").addEventListener("click", changeRollSpeed);
document.getElementById("confirmPotion").addEventListener("click", confirmPotion);
