function drawPieChart(doc, data, x, y, width, height, colors) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const radius = Math.min(width, height) / 2 - 15;
    const innerRadius = radius * 0.5;

    const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
    if (total === 0) return y + height;

    let startAngle = -Math.PI / 2;

    data.forEach((item, index) => {
        const value = item.value || 0;
        const sliceAngle = (value / total) * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;

        const x1 = cx + radius * Math.cos(startAngle);
        const y1 = cy + radius * Math.sin(startAngle);
        const x2 = cx + radius * Math.cos(endAngle);
        const y2 = cy + radius * Math.sin(endAngle);

        const ix1 = cx + innerRadius * Math.cos(startAngle);
        const iy1 = cy + innerRadius * Math.sin(startAngle);
        const ix2 = cx + innerRadius * Math.cos(endAngle);
        const iy2 = cy + innerRadius * Math.sin(endAngle);

        const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
        const color = colors[index % colors.length];

        doc.fillColor(color);
        doc.path(`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix1} ${iy1} Z`)
           .fill();

        startAngle = endAngle;
    });

    return y + height;
}

function drawBarChart(doc, data, x, y, width, height, colors) {
    const padding = { top: 25, right: 10, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxValue = Math.max(...data.map(d => d.value || 0), 1);
    const barCount = data.length;
    const barWidth = Math.min(60, (chartWidth / barCount) * 0.6);
    const barSpacing = (chartWidth - barWidth * barCount) / (barCount + 1);

    doc.font('Helvetica').fontSize(8);

    data.forEach((item, index) => {
        const value = item.value || 0;
        const barHeight = (value / maxValue) * chartHeight;
        const bx = padding.left + x + barSpacing + index * (barWidth + barSpacing);
        const by = y + padding.top + chartHeight - barHeight;
        const color = item.color || colors[index % colors.length];

        doc.fillColor(color);
        doc.rect(bx, by, barWidth, barHeight).fill();

        doc.fillColor('#334155');
        doc.text(value.toString(), bx + barWidth / 2, by - 6, { width: barWidth, align: 'center' });

        doc.fontSize(7);
        const labelY = y + height - 12;
        doc.text(item.label.substring(0, 10), bx + barWidth / 2, labelY, { width: barWidth, align: 'center' });
        doc.fontSize(8);
    });

    return y + height;
}

export { drawPieChart, drawBarChart };
