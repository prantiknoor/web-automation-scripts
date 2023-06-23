// ==UserScript==
// @name         Auto Train Ticket Booker
// @namespace    https://github.com/prantiknoor/web-automation-scripts
// @version      1.0
// @description  Book ticket faster than ever
// @author       Prantik
// @match 		 https://eticket.railway.gov.bd/booking/train/search?*
// @icon         https://cdn-icons-png.flaticon.com/128/2570/2570693.png
// @grant        none
// ==/UserScript==

let taskCard;

function getTimeToStart() {
    const date = new Date();
    date.setHours(12, 0, 1, 0); // hour:minute:second:millisecond
    return date;
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

    function addEventListenerToBtn(card) {
        const button = card.querySelector('button.btn-auto-book');

        let countdown = null;
        button.addEventListener('click', function () {
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
            let timeToStart = getTimeToStart();
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
