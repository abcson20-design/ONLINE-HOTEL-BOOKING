/**
 * PHIÊN BẢN SAI, chỉ dùng trong test để chứng minh race condition.
 * Đọc trạng thái -> (await) -> ghi trạng thái, KHÔNG có khóa.
 * Giữa hai bước đó request khác chen vào nên nhiều người cùng thấy phòng "trống".
 */
export async function naiveHold(db, userId, seatId) {
    const seat = await db.findById("seats", seatId);
    if (seat.trang_thai !== "trong") throw new Error("Phòng đã có người giữ");
    await db.update("seats", seatId, { trang_thai: "dang_giu" });
    return db.insert("holds", { seat_id: seatId, user_id: userId });
}
