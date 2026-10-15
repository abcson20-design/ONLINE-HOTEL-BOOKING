/**
 * Mô phỏng NHIỀU NGƯỜI ĐẶT CÙNG LÚC (yêu cầu Y2).
 * Bắn N yêu cầu giữ phòng bất đồng bộ gần như đồng thời rồi kiểm tra tính toàn vẹn:
 * không phòng nào có quá 1 lượt giữ.
 */
export async function simulateConcurrentHolds(holdService, { userCount, pickSeats }) {
    const users = Array.from({ length: userCount }, (_, index) => `sim-user-${index + 1}`);

    const outcomes = await Promise.allSettled(
        users.map((userId, index) => holdService.holdSeats(userId, pickSeats(index))),
    );

    const winners = [];
    const failureReasons = {};
    outcomes.forEach((outcome, index) => {
        if (outcome.status === "fulfilled") {
            winners.push(users[index]);
        } else {
            const code = outcome.reason?.code ?? "UNKNOWN";
            failureReasons[code] = (failureReasons[code] ?? 0) + 1;
        }
    });

    // Kiểm tra toàn vẹn: mỗi phòng liên quan chỉ được có tối đa 1 hold.
    const touchedSeatIds = [...new Set(users.flatMap((_, index) => pickSeats(index)))];
    const doubleBooked = [];
    for (const seatId of touchedSeatIds) {
        const holds = await holdService.getHoldsBySeat(seatId);
        if (holds.length > 1) doubleBooked.push({ seatId, holders: holds.map((h) => h.user_id) });
    }

    return {
        userCount,
        successCount: winners.length,
        failureCount: userCount - winners.length,
        winners,
        failureReasons,
        doubleBooked,
        isSafe: doubleBooked.length === 0,
    };
}
