// K3L Rentals - AI Vehicle & Travel Recommendation Assistant
(function () {
    const db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

    let chatFleet = [];
    let isFleetLoaded = false;

    // Load available fleet vehicles for dynamic AI recommendations
    async function fetchFleet() {
        if (!db || isFleetLoaded) return;
        try {
            const snap = await db.collection("vehicles").get();
            chatFleet = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            isFleetLoaded = true;
        } catch (e) {
            console.warn("Chatbot fleet fetch note:", e);
        }
    }

    function initChatbotUI() {
        if (document.getElementById("k3lChatbotRoot")) return;

        const root = document.createElement("div");
        root.id = "k3lChatbotRoot";
        root.innerHTML = `
            <!-- Chatbot Toggle Button -->
            <button id="chatbotToggleBtn" title="Ask K3L Travel Assistant" style="position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px; border-radius: 50%; background: #2563eb; color: white; border: none; box-shadow: 0 4px 14px rgba(37,99,235,0.4); cursor: pointer; z-index: 999; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; transition: transform 0.2s ease;">
                🤖
            </button>

            <!-- Chatbot Window -->
            <div id="chatbotWindow" style="display: none; position: fixed; bottom: 90px; right: 24px; width: 380px; max-width: calc(100vw - 32px); height: 520px; max-height: calc(100vh - 120px); background: white; border-radius: 16px; box-shadow: 0 12px 35px rgba(15,23,42,0.2); border: 1px solid #e2e8f0; z-index: 1000; flex-direction: column; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                
                <!-- Chat Header -->
                <div style="background: #0f172a; color: white; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.4rem;">🚗</span>
                        <div>
                            <strong style="font-size: 0.95rem; display: block;">K3L Travel Assistant</strong>
                            <small style="color: #4ade80; font-size: 0.75rem;">● Online • Live Fleet Recommendations</small>
                        </div>
                    </div>
                    <button id="closeChatBtn" style="background: none; border: none; color: #94a3b8; font-size: 1.4rem; cursor: pointer;">&times;</button>
                </div>

                <!-- Chat Messages Body -->
                <div id="chatbotMessages" style="flex: 1; padding: 16px; overflow-y: auto; background: #f8fafc; display: flex; flex-direction: column; gap: 12px;">
                    <!-- Initial Welcome Message -->
                    <div class="chat-msg bot-msg" style="align-self: flex-start; max-width: 88%; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); font-size: 0.88rem; line-height: 1.45; color: #1e293b;">
                        👋 Hello! I am your <strong>K3L Travel &amp; Vehicle Assistant</strong>.
                        <p style="margin-top: 6px;">Looking for vehicle suggestions for an Ooty road trip, weekend bike ride, or rental rules? Pick a quick option below or ask me anything!</p>
                    </div>

                    <!-- Quick Suggestion Chips -->
                    <div id="chatbotChips" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;">
                        <button class="chat-chip" data-query="quiz">🎯 Match My Ride (Quiz)</button>
                        <button class="chat-chip" data-query="Best car for Ooty / Kodaikanal hill trip">⛰️ Ooty Hill Trip</button>
                        <button class="chat-chip" data-query="Suggest bikes for road trip">🏍️ Weekend Bike Ride</button>
                        <button class="chat-chip" data-query="Budget commuter car for city">💰 Budget City Car</button>
                        <button class="chat-chip" data-query="What documents and age are required?">📋 Rental Rules</button>
                        <button class="chat-chip" data-query="How does the 25% advance payment work?">💳 Advance Payment</button>
                    </div>
                </div>

                <!-- Chat Input Form -->
                <form id="chatbotInputForm" style="display: flex; gap: 8px; padding: 12px; background: white; border-top: 1px solid #e2e8f0;">
                    <input type="text" id="chatbotInputText" placeholder="Ask about trips, cars, bikes, rules..." style="flex: 1; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.88rem; outline: none;">
                    <button type="submit" style="background: #2563eb; color: white; border: none; border-radius: 8px; padding: 0 16px; font-weight: 600; cursor: pointer; font-size: 0.9rem;">
                        Send
                    </button>
                </form>
            </div>
        `;

        document.body.appendChild(root);

        // Add chip styling
        const style = document.createElement("style");
        style.textContent = `
            .chat-chip {
                background: #eff6ff;
                border: 1px solid #bfdbfe;
                color: #1e40af;
                padding: 5px 10px;
                border-radius: 14px;
                font-size: 0.78rem;
                cursor: pointer;
                font-weight: 500;
                transition: background 0.15s;
            }
            .chat-chip:hover {
                background: #dbeafe;
            }
        `;
        document.head.appendChild(style);

        const toggleBtn = document.getElementById("chatbotToggleBtn");
        const chatWindow = document.getElementById("chatbotWindow");
        const closeBtn = document.getElementById("closeChatBtn");
        const inputForm = document.getElementById("chatbotInputForm");
        const inputText = document.getElementById("chatbotInputText");

        toggleBtn.addEventListener("click", async () => {
            await fetchFleet();
            const isOpen = chatWindow.style.display === "flex";
            chatWindow.style.display = isOpen ? "none" : "flex";
            if (!isOpen) {
                inputText.focus();
            }
        });

        closeBtn.addEventListener("click", () => {
            chatWindow.style.display = "none";
        });

        // Quick chips handler
        document.getElementById("chatbotChips").addEventListener("click", e => {
            if (e.target.classList.contains("chat-chip")) {
                const query = e.target.dataset.query;
                handleUserMessage(query);
            }
        });

        // Interactive quiz click delegation
        document.getElementById("chatbotMessages").addEventListener("click", e => {
            const destBtn = e.target.closest("button[data-quiz-dest]");
            if (destBtn) {
                handleQuizDest(destBtn.dataset.quizDest);
                return;
            }
            const paxBtn = e.target.closest("button[data-quiz-pax]");
            if (paxBtn) {
                handleQuizPax(paxBtn.dataset.quizPax);
                return;
            }
        });

        inputForm.addEventListener("submit", e => {
            e.preventDefault();
            const q = inputText.value.trim();
            if (!q) return;
            inputText.value = "";
            handleUserMessage(q);
        });
    }

    function appendMessage(sender, htmlContent) {
        const msgContainer = document.getElementById("chatbotMessages");
        if (!msgContainer) return;

        const isUser = sender === "user";
        const bubble = document.createElement("div");
        bubble.className = isUser ? "chat-msg user-msg" : "chat-msg bot-msg";
        bubble.style.maxWidth = "88%";
        bubble.style.borderRadius = "12px";
        bubble.style.padding = "10px 14px";
        bubble.style.fontSize = "0.88rem";
        bubble.style.lineHeight = "1.45";

        if (isUser) {
            bubble.style.alignSelf = "flex-end";
            bubble.style.background = "#2563eb";
            bubble.style.color = "white";
        } else {
            bubble.style.alignSelf = "flex-start";
            bubble.style.background = "white";
            bubble.style.border = "1px solid #e2e8f0";
            bubble.style.color = "#1e293b";
            bubble.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
        }

        bubble.innerHTML = htmlContent;
        msgContainer.appendChild(bubble);
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    let selectedQuizDest = null;

    function handleQuizDest(dest) {
        selectedQuizDest = dest;
        const labels = {
            hills: "⛰️ Hill Stations (Ooty, Coonoor, Kodaikanal)",
            city: "🏙️ City Commute & Local Running",
            highway: "🛣️ Long Distance Highway Cruising"
        };
        appendMessage("user", labels[dest] || dest);
        appendMessage("bot", `
            <p style="margin-bottom: 8px;"><strong>Step 2 of 2:</strong> How many people are traveling?</p>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                <button class="chat-chip" data-quiz-pax="1-2">Solo / Duo (1–2 Riders/Passengers)</button>
                <button class="chat-chip" data-quiz-pax="3-5">Family / Small Group (3–5)</button>
                <button class="chat-chip" data-quiz-pax="6+">Large Family / Group (6+)</button>
            </div>
        `);
    }

    function handleQuizPax(pax) {
        appendMessage("user", `${pax} People Traveling`);
        let matches = [];

        if (pax === "1-2" && selectedQuizDest !== "hills") {
            matches = chatFleet.filter(v => v.category === "bike" || (v.category === "car" && Number(v.price_per_day || 0) <= 2500));
        } else if (pax === "6+" || selectedQuizDest === "hills") {
            matches = chatFleet.filter(v => {
                const m = String(v.model || "").toLowerCase();
                const t = String(v.type || "").toLowerCase();
                return t.includes("suv") || m.includes("innova") || m.includes("scorpio") || m.includes("thar") || m.includes("creta");
            });
            if (matches.length === 0) {
                matches = chatFleet.filter(v => v.category === "car");
            }
        } else {
            matches = chatFleet.filter(v => v.category === "car");
        }

        const top = matches.slice(0, 3);
        let reply = `🎉 <strong>Matched Fleet Vehicles for Your Trip:</strong><br>`;
        if (top.length > 0) {
            reply += `<div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">`;
            top.forEach(v => {
                reply += `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: #0f172a;">${escapeHTML(v.model)}</strong>
                            <small style="display: block; color: #64748b;">📍 ${escapeHTML(v.location || 'Coimbatore')} • ₹${Number(v.price_per_day || 0).toLocaleString("en-IN")}/day</small>
                        </div>
                        <a href="booking.html?id=${encodeURIComponent(v.id)}" style="background: #2563eb; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.78rem; text-decoration: none; font-weight: 600;">
                            Book Now
                        </a>
                    </div>
                `;
            });
            reply += `</div>`;
        } else {
            reply += `<p style="margin-top: 4px;">Explore our fleet catalog to see all vehicles matching your criteria.</p>`;
        }
        appendMessage("bot", reply);
    }

    async function handleUserMessage(query) {
        appendMessage("user", escapeHTML(query));
        await fetchFleet();

        const lower = query.toLowerCase();

        // 0. Interactive Quiz
        if (lower === "quiz" || lower.includes("match my ride")) {
            appendMessage("bot", `
                🎯 <strong>Match My Ride Questionnaire:</strong>
                <p style="margin: 6px 0 10px;"><strong>Step 1 of 2:</strong> What is your destination terrain?</p>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <button class="chat-chip" data-quiz-dest="hills" style="text-align: left; padding: 8px 12px;">⛰️ Hill Stations (Ooty, Coonoor, Kodaikanal)</button>
                    <button class="chat-chip" data-quiz-dest="city" style="text-align: left; padding: 8px 12px;">🏙️ City Commute &amp; Local Running</button>
                    <button class="chat-chip" data-quiz-dest="highway" style="text-align: left; padding: 8px 12px;">🛣️ Long Distance Highway Cruising</button>
                </div>
            `);
            return;
        }

        // 1. Hills / Ooty / Kodaikanal
        if (lower.includes("ooty") || lower.includes("kodaikanal") || lower.includes("hill") || lower.includes("ghat") || lower.includes("suv") || lower.includes("family")) {
            const suvs = chatFleet.filter(v => {
                const cat = String(v.category || "").toLowerCase();
                const type = String(v.type || "").toLowerCase();
                const model = String(v.model || "").toLowerCase();
                return cat === "car" && (type.includes("suv") || model.includes("thar") || model.includes("scorpio") || model.includes("innova") || model.includes("creta") || model.includes("brezza"));
            });

            const topMatches = suvs.slice(0, 3);
            let reply = `⛰️ <strong>Hill Station &amp; Ghat Recommendations:</strong><br>For driving up to Ooty, Coonoor, or Kodaikanal, high ground clearance and reliable hill-climb torque are essential.`;

            if (topMatches.length > 0) {
                reply += `<div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">`;
                topMatches.forEach(v => {
                    reply += `
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="color: #0f172a;">${escapeHTML(v.model)}</strong>
                                <small style="display: block; color: #64748b;">📍 ${escapeHTML(v.location || 'Coimbatore')} • ₹${Number(v.price_per_day || 0).toLocaleString("en-IN")}/day</small>
                            </div>
                            <a href="booking.html?id=${encodeURIComponent(v.id)}" style="background: #2563eb; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.78rem; text-decoration: none; font-weight: 600;">
                                Book Now
                            </a>
                        </div>
                    `;
                });
                reply += `</div>`;
            } else {
                reply += `<br>Explore our car catalog for top-tier SUVs.`;
            }

            appendMessage("bot", reply);
            return;
        }

        // 2. Bikes / Motorcycle road trip
        if (lower.includes("bike") || lower.includes("bullet") || lower.includes("enfield") || lower.includes("ride") || lower.includes("motorcycle")) {
            const bikes = chatFleet.filter(v => String(v.category || "").toLowerCase() === "bike");
            const topBikes = bikes.slice(0, 3);

            let reply = `🏍️ <strong>Bikes for Road Trips &amp; Commuting:</strong><br>Bikes offer great fuel efficiency and scenic immersion across the Coimbatore → Erode → Salem corridor.`;

            if (topBikes.length > 0) {
                reply += `<div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">`;
                topBikes.forEach(v => {
                    reply += `
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="color: #0f172a;">${escapeHTML(v.model)}</strong>
                                <small style="display: block; color: #64748b;">📍 ${escapeHTML(v.location || 'Coimbatore')} • ₹${Number(v.price_per_day || 0).toLocaleString("en-IN")}/day</small>
                            </div>
                            <a href="booking.html?id=${encodeURIComponent(v.id)}" style="background: #2563eb; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.78rem; text-decoration: none; font-weight: 600;">
                                Book Now
                            </a>
                        </div>
                    `;
                });
                reply += `</div>`;
            } else {
                reply += `<br>Check out our fleet catalog for premium two-wheelers.`;
            }

            appendMessage("bot", reply);
            return;
        }

        // 3. Rental Rules & Age
        if (lower.includes("rule") || lower.includes("age") || lower.includes("document") || lower.includes("licence") || lower.includes("license") || lower.includes("aadhaar") || lower.includes("pan")) {
            appendMessage("bot", `
                📋 <strong>K3L Rentals Policies:</strong>
                <ul style="margin-left: 18px; margin-top: 6px; font-size: 0.85rem; line-height: 1.5;">
                    <li><strong>Minimum Age:</strong> 18 years old or older.</li>
                    <li><strong>Required Documents:</strong> Valid Driving Licence (DL) + Aadhaar Card OR PAN Card.</li>
                    <li><strong>Rental Duration:</strong> 1 to 7 consecutive days.</li>
                    <li><strong>Verification:</strong> Upload documents online; admin reviews them in 15–30 mins.</li>
                </ul>
            `);
            return;
        }

        // 4. Advance Payment
        if (lower.includes("advance") || lower.includes("payment") || lower.includes("pay") || lower.includes("upi") || lower.includes("deposit") || lower.includes("25%")) {
            appendMessage("bot", `
                💳 <strong>25% Advance Payment Policy:</strong>
                <p style="margin-top: 4px;">To guarantee and lock your vehicle without cancellations, K3L Rentals collects <strong>exactly 25% of the total rental amount</strong> as an advance deposit upon document approval.</p>
                <p style="margin-top: 6px;">You can pay via dynamic <strong>UPI QR code</strong> (GPay/PhonePe/Paytm/BHIM) and submit your 12-digit UTR. The remaining <strong>75% balance</strong> is settled at the vehicle pickup hub!</p>
            `);
            return;
        }

        // 5. Budget / Cheap City Commuter
        if (lower.includes("budget") || lower.includes("cheap") || lower.includes("low") || lower.includes("city") || lower.includes("economy")) {
            const sortedByPrice = [...chatFleet].sort((a, b) => Number(a.price_per_day || 0) - Number(b.price_per_day || 0)).slice(0, 3);
            let reply = `💰 <strong>Most Affordable Fleet Vehicles:</strong><br>`;
            reply += `<div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">`;
            sortedByPrice.forEach(v => {
                reply += `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: #0f172a;">${escapeHTML(v.model)}</strong>
                            <small style="display: block; color: #16a34a; font-weight: 600;">₹${Number(v.price_per_day || 0).toLocaleString("en-IN")}/day</small>
                        </div>
                        <a href="booking.html?id=${encodeURIComponent(v.id)}" style="background: #2563eb; color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.78rem; text-decoration: none; font-weight: 600;">
                            Book Now
                        </a>
                    </div>
                `;
            });
            reply += `</div>`;
            appendMessage("bot", reply);
            return;
        }

        // Fallback default helpful response
        appendMessage("bot", `
            I can help you select the ideal car or bike, explain our 18+ document verification, or guide you through the 25% advance payment.
            <div style="margin-top: 8px;">
                <a href="vehicles.html" style="color: #2563eb; font-weight: 600; text-decoration: underline;">Explore Full Fleet Catalog →</a>
            </div>
        `);
    }

    function escapeHTML(str) {
        return String(str || "").replace(/[&<>"']/g, c => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[c]);
    }

    document.addEventListener("DOMContentLoaded", initChatbotUI);
    if (document.readyState === "complete" || document.readyState === "interactive") {
        initChatbotUI();
    }
})();

