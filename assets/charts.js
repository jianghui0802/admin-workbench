// assets/charts.js
(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();

  // --- Chart: Dept Fee Distribution ---
  var chartDeptFee = echarts.init(document.getElementById('chart-dept-fee'), null, { renderer: 'svg' });

  var deptData = [
    { value: 2860, name: '技术部' },
    { value: 2150, name: '销售部' },
    { value: 1680, name: '市场部' },
    { value: 980,  name: '财务部' },
    { value: 590,  name: '人事部' }
  ];

  chartDeptFee.setOption({
    animation: false,
    tooltip: {
      trigger: 'item',
      appendToBody: true,
      formatter: function(p) {
        return p.name + '<br/>费用：¥' + p.value.toLocaleString() + '<br/>占比：' + p.percent + '%';
      }
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { color: muted, fontSize: 12, fontFamily: 'InstrumentSans, sans-serif' },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 12
    },
    series: [{
      type: 'pie',
      radius: ['45%', '72%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 6,
        borderColor: bg2,
        borderWidth: 2
      },
      label: { show: false },
      emphasis: {
        label: {
          show: true,
          fontSize: 13,
          fontWeight: 'bold',
          color: ink,
          formatter: '{b}\n¥{c}'
        }
      },
      color: [accent, accent2, '#6366f1', '#10b981', '#f472b6'],
      data: deptData
    }]
  });

  window.addEventListener('resize', function() { chartDeptFee.resize(); });
})();