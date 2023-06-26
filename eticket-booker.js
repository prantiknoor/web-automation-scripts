// ==UserScript==
// @name         Auto Train Ticket Booker
// @namespace    https://github.com/prantiknoor/web-automation-scripts
// @version      2.0
// @description  Book ticket faster than ever
// @author       Prantik
// @match 		 https://eticket.railway.gov.bd/booking/train/*
// @icon         https://cdn-icons-png.flaticon.com/128/2570/2570693.png
// @grant        GM_addStyle
// ==/UserScript==

let taskCard;

function showPopupToGetTime() {
    // Function to get the current time in HH:MM format
    function getDefaultTime() {
        const now = new Date();
        if(now.getHours() < 8) {
            now.setHours(8);
            now.setMinutes(0);
        }
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    // Create the popup window
    const popupContainer = document.createElement('div');
    popupContainer.className = 'popup-container';
    popupContainer.innerHTML = `
        <div class="popup-title">Auto ticket book</div>
        <div class="popup-input">
            <label for="time">When to start:</label>
            <input type="time" id="time" name="time" value="${getDefaultTime()}">
        </div>
        <div class="popup-buttons">
            <button id="cancel-btn">Cancel</button>
            <button id="start-btn">Start Now</button>
        </div>
    `;

    // Add the popup to the page
    document.body.appendChild(popupContainer);

    // Get the time input and buttons
    const timeInput = document.getElementById('time');
    const startBtn = document.getElementById('start-btn');
    const startNowBtn = document.getElementById('start-now-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    // Function to close the popup and remove it from the page
    function closePopup() {
        document.body.removeChild(popupContainer);
    }

    // Promise to handle the asynchronous behavior
    return new Promise((resolve) => {
        // Event listeners for the buttons
        startBtn.addEventListener('click', () => {
            const selectedTime = timeInput.value;
            closePopup();
            const date = new Date();
            const [hours, minutes] = selectedTime.split(':');
            date.setHours(hours);
            date.setMinutes(minutes);
            date.setSeconds(1);
            resolve(date);
        });

        cancelBtn.addEventListener('click', () => {
            closePopup();
            resolve(false);
        });
    });
}


(async function () {
    'use strict';

    function getSeats(floorIndex) {
        const seats = [];
        let dividerIndex = 0;
        const columns = Array.from(document.querySelectorAll(`#floor-${floorIndex} ul`));
        const rowCount = columns[0].childElementCount;

        for (let i = 0; i < rowCount; i++) {
            const row = [];

            for (let j = 0; j < 5; j++) {
                if (j === 2) continue;
                row.push(columns[j].children[i]);
            }

            if (row.map(cell => cell.innerText).join('').trim()) {
                seats.push(row);
            } else {
                dividerIndex = i;
            }
        }

        let fSegment = seats.slice(0, dividerIndex);
        fSegment = fSegment.reverse();
        const lSegment = seats.slice(dividerIndex);

        return { fSegment, lSegment };
    }

    function getActiveSelectEl() {
        return document.querySelector('div[style*="block"] .selectpicker');
    }

    function getMostAvailableFloorIndex(selectEl) {
        let maxValue = 0;
        let floorIndex;

        selectEl.querySelectorAll('option').forEach(option => {
            const value = parseInt(option.textContent.match(/\d+/));

            if (value && value > maxValue) {
                maxValue = value;
                floorIndex = option.value;
            }
        });
        selectEl.value = floorIndex;

        return floorIndex;
    }

    function showFloor(floorIndex) {
        document.querySelector('div[id^="floor"]').style.display = "none";
        const floorDiv = document.querySelector(`#floor-${floorIndex}`);
        floorDiv.style.display = 'block';
    }

    function getSeatsForSelection(seats) {
        const preferences = [
            [1, 2, 3, 4, 5, 0, 6, 7, 8, 9],
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        ];
        let seatsForSelection = [];
        let preferenceNo = 0;

        seats.forEach(segment => {
            for (let i = 0; i < segment.length; i++) {
                let rowNo = preferences[preferenceNo][i];
                let row = segment[rowNo];
                for (let j = 0; j < row.length; j++) {
                    let seat = row[j];
                    if (seatsForSelection.length >= 4) break;
                    if (seat.querySelector('a.seat-available:not(.booked)')) {
                        seatsForSelection.push(seat);

                        if (rowNo == 0) preferenceNo = 1;
                    }
                }
                if (seatsForSelection.length >= 4) break;
            }
        })
        return seatsForSelection;
    }

    function selectSeats(seatsForSelection) {
        seatsForSelection.forEach(seat => {
            seat.querySelector('a').click();
        })
    }

    function bookTicket() {
        const selectEl = getActiveSelectEl();

        if (!selectEl) {
            return alert('No selectEl found');
        }

        const floorIndex = getMostAvailableFloorIndex(selectEl);
        console.log('~ ✅ Most available floor index is ', floorIndex);
        showFloor(floorIndex);
        const { fSegment, lSegment } = getSeats(floorIndex);
        let seats = sortSeatSegments(fSegment, lSegment);
        const seatsForSelection = getSeatsForSelection(seats);
        selectSeats(seatsForSelection);
        console.log(`~ ✅ Selected seats: ${seatsForSelection.map(seat => seat.innerText).reverse().join(', ')}`);
    }

    function sortSeatSegments(fSegment, lSegment) {
        const fromToLocEl = document.querySelector('p.from_to_location');
        if (fromToLocEl) {
            const from = fromToLocEl.innerText.split(' - ')[0];
            if (from == "Dhaka") return [lSegment, fSegment];
        }
        return [fSegment, lSegment];
    }

    function getCards() {
        return Array.from(document.querySelectorAll('div.seat-available-wrap:not(.no-seat-available-wrap)'))
            .filter(div => /S_CHAIR|SNIGDHA|SHOVAN/g.test(div.innerText));
    }

    function injectButtonToCard(card) {
        const btnHtml = `<button class="btn-auto-book" style="position: absolute; top: -14px;font-size: 10px;background: #03a84e;right: -8px;border: none;color: white;font-weight: bold;border-radius: 16px;padding: 4px 8px;">AUTO BOOK</button>`;
        card.insertAdjacentHTML('beforeend', btnHtml);
        card.style.position = 'relative';
        addEventListenerToBtn(card);
    }

    async function addEventListenerToBtn(card) {
        const button = card.querySelector('button.btn-auto-book');

        let countdown = null;
        button.addEventListener('click', async function () {
            if (!isUserLoggedIn()) {
                return clickOnBookBtn(card);
            }

            if (taskCard && taskCard != card) return alert('There already is an another task');

            if (countdown) {
                clearInterval(countdown);
                countdown = null;
                taskCard = null;
                button.textContent = 'Auto book';
                button.style.background = '#03a84e';
                return;
            }

            taskCard = card;
            let timeToStart = await showPopupToGetTime();
            button.style.background = "tomato";

            countdown = setInterval(async function () {
                button.textContent = formatDuration((timeToStart - new Date()) / 1000);

                if (new Date() >= timeToStart) {
                    clearInterval(countdown);
                    countdown = null;
                    taskCard = null;

                    button.textContent = 'Running...';

                    clickOnBookBtn(card);
                    const btnClickedTime = new Date();
                    console.log(`~ ✅ (${getFormattedCurrentTime()}) Clicked on BOOK NOW Button.`);

                    await waitForElement('.seat_layout');

                    console.log(`~ ✅ (${getFormattedCurrentTime()}) Seat Layout Loaded. (${(new Date() - btnClickedTime) / 1000}s)`);

                    bookTicket();

                    button.textContent = 'Done';
                    button.style.background = "#03a84e";
                }
            }, 250);
            console.log(`~ ✅ (${getFormattedCurrentTime()}) Countdown started.`);
        });
    }

    const getFormattedCurrentTime = () => new Date().toLocaleTimeString('en-US', { hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric', fractionalSecondDigits: 2 });

    function clickOnBookBtn(card) {
        if (card) card.querySelector('.book-now-btn').click();
    }

    function isUserLoggedIn() {
        return document.querySelector('.user-name-text');
    }

    function formatDuration(durationInSeconds) {
        const rtf = new Intl.RelativeTimeFormat('en');
        if (durationInSeconds < 1) return 'Starting...';
        return durationInSeconds <= 30
            ? rtf.format(Math.floor(durationInSeconds), 'second')
        : rtf.format(Math.ceil(durationInSeconds / 60), 'minute');
    }


    async function waitForElement(query) {
        let element;
        do {
            element = document.querySelector(query);
            if (element) {
                return element;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        } while (!element);
    }

    async function main() {
        await waitForElement('div#search_result');
        console.log('~ ✅ Search result is shown.');
        const cards = getCards();
        cards.forEach(card => injectButtonToCard(card));
        console.log('~ ✅ Buttons are injected to the cards.');
    }

    main();
})();

GM_addStyle(`
    .popup-container {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #fff;
        border-radius: 4px;
        padding: 20px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        font-family: Arial, sans-serif;
    }

    .popup-title {
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 10px;
    }

    .popup-input {
        margin-bottom: 15px;
    }

    .popup-input label {
        display: block;
        margin-bottom: 5px;
    }

    .popup-input input[type="time"] {
        padding: 6px 10px;
        font-size: 14px;
        border-radius: 4px;
        border: 1px solid #ccc;
        width: 100%;
        box-sizing: border-box;
    }

    .popup-buttons {
        text-align: center;
    }

    .popup-buttons button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        margin-right: 10px;
    }

    .popup-buttons button:last-child {
        margin-right: 0;
    }

    #start-btn {
        border: 1px solid #03a84e;
    }
`);
