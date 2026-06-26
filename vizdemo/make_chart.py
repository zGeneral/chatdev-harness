import matplotlib
matplotlib.use('Agg')  # non-interactive backend, no display
import matplotlib.pyplot as plt

months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
units = [120, 135, 98, 160, 180, 210]

fig, ax = plt.subplots(figsize=(8, 5))
bars = ax.bar(months, units, color='#4C72B0')

ax.set_title('Monthly Sales (H1)')
ax.set_xlabel('Month')
ax.set_ylabel('Units')

for bar, value in zip(bars, units):
    ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 2,
            str(value), ha='center', va='bottom')

ax.set_ylim(0, max(units) * 1.15)
fig.tight_layout()
fig.savefig('vizdemo/chart.png', dpi=120)
print('Chart saved to vizdemo/chart.png')
