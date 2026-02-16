const discoverMarkets = require('../lib/discover_markets');
const api = require('../lib/api');

// Mock puppeteer-extra
jest.mock('puppeteer-extra', () => ({
    use: jest.fn(),
    launch: jest.fn(),
}));

// Mock puppeteer-extra-plugin-stealth
jest.mock('puppeteer-extra-plugin-stealth', () => jest.fn());

// Mock API
jest.mock('../lib/api', () => ({
    getEvent: jest.fn(),
}));

describe('Market Discovery', () => {
    let mockPage;
    let mockBrowser;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Mock Browser and Page
        mockPage = {
            on: jest.fn(),
            goto: jest.fn(),
            waitForSelector: jest.fn(),
            evaluate: jest.fn(),
            close: jest.fn(),
        };

        mockBrowser = {
            newPage: jest.fn().mockResolvedValue(mockPage),
            close: jest.fn(),
        };

        require('puppeteer-extra').launch.mockResolvedValue(mockBrowser);
    });

    test('frontPageMarkets should scrape and enrich markets', async () => {
        // Mock scraping result
        const scrapedMarkets = [
            {
                title: 'Market 1',
                link: 'https://kalshi.com/markets/ticker1/slug1',
                slug: 'ticker1',
                sourceUrl: 'https://www.youtube.com/watch?v=AxxVM_Vfcck'
            },
            {
                title: 'Market 2',
                link: 'https://kalshi.com/markets/ticker2/slug2',
                slug: 'ticker2',
                sourceUrl: 'https://www.youtube.com/watch?v=AxxVM_Vfcck'
            }
        ];
        mockPage.evaluate.mockResolvedValue(scrapedMarkets);

        // Mock API responses
        api.getEvent.mockImplementation(async (ticker) => {
            if (ticker === 'TICKER1') {
                return {
                    event: {
                        ticker: 'TICKER1',
                        open_time: '2026-03-01T12:00:00Z',
                        expiration_time: '2026-03-01T14:00:00Z',
                        status: 'active'
                    }
                };
            } else if (ticker === 'TICKER2') {
                return {
                    event: {
                        ticker: 'TICKER2',
                        open_time: '2026-03-02T10:00:00Z',
                        expiration_time: '2026-03-02T16:00:00Z',
                        status: 'closed'
                    }
                };
            }
            throw new Error('Not Found');
        });

        const result = await discoverMarkets.frontPageMarkets();

        // Verify Puppeteer interactions
        expect(mockPage.goto).toHaveBeenCalledWith('https://kalshi.com/category/mentions', expect.any(Object));
        expect(mockPage.evaluate).toHaveBeenCalled();
        expect(mockBrowser.close).toHaveBeenCalled();

        // Verify API calls
        expect(api.getEvent).toHaveBeenCalledTimes(2);
        expect(api.getEvent).toHaveBeenCalledWith('TICKER1', true);
        expect(api.getEvent).toHaveBeenCalledWith('TICKER2', true);

        // Verify enriched results
        expect(result).toHaveLength(2);

        // Check first market enrichment (using start_time)
        expect(result[0].slug).toBe('ticker1');
        expect(result[0].eventStartTime).toBe(new Date('2026-03-01T12:00:00Z').getTime());
        expect(result[0].eventCloseTime).toBe(new Date('2026-03-01T14:00:00Z').getTime());

        // Check second market enrichment (using open_time/expiration_time which fallbacks if start_time not present)
        // Wait, current logic prefers start_time if available. My mock has start_time for 1 and open_time for 2.
        // Let's verify logic.
        expect(result[1].slug).toBe('ticker2');
        expect(result[1].eventStartTime).toBe(new Date('2026-03-02T10:00:00Z').getTime()); // Logic falls back? No, logic uses open_time explicitly now.
        expect(result[1].eventCloseTime).toBe(new Date('2026-03-02T16:00:00Z').getTime());
    });

    test('getEventMetadata should handle API errors gracefully', async () => {
        // Mock scraping result
        const scrapedMarkets = [{ title: 'Bad Market', link: '...', slug: 'badticker' }];
        mockPage.evaluate.mockResolvedValue(scrapedMarkets);

        // Mock API failure
        api.getEvent.mockRejectedValue(new Error('API Error'));

        const result = await discoverMarkets.frontPageMarkets();

        // Should return empty array or filtered result? 
        // Logic says: if (enriched) { enrichedMarkets.push(enriched); }
        // getEventMetadata returns null on error.
        // So result should be empty.
        expect(result).toHaveLength(0);
    });
});
