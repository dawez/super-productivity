import {EntityState} from '@ngrx/entity';
import {Task} from '../tasks/task.model';
import {getWeeksInMonth} from '../../util/get-weeks-in-month';
import {getWeekNumber} from '../../util/get-week-number';
import * as moment from 'moment';
import {WorkStartEnd} from '../project/project.model';
import {Worklog, WorklogDay, WorklogMonth, WorklogWeek, WorklogYear} from './worklog.model';
import {getWorklogStr} from '../../util/get-work-log-str';

// Provides defaults to display tasks without time spent on them
const _getTimeSpentOnDay = (entities, task): { [key: string]: number } => {
  const isTimeSpentTracked = (task.timeSpentOnDay && !!Object.keys(task.timeSpentOnDay).length);
  if (isTimeSpentTracked) {
    return task.timeSpentOnDay;
  } else if (task.parentId) {
    const parentSpentOnDay = task.parentId && entities[task.parentId].timeSpentOnDay;
    const parentLogEntryDate = parentSpentOnDay && (
      Object.keys(parentSpentOnDay)[0]
      || getWorklogStr(entities[task.parentId].created));
    return {[parentLogEntryDate]: 1};
  } else {
    return {[getWorklogStr(task.created)]: 1};
  }
};

export const mapArchiveToWorklog = (
  taskState: EntityState<Task>,
  noRestoreIds = [],
  startEnd: { workStart: WorkStartEnd, workEnd: WorkStartEnd }):
  {
    worklog: Worklog, totalTimeSpent
  } => {
  const entities = taskState.entities;
  const worklog: Worklog = {};
  let totalTimeSpent = 0;
  Object.keys(entities).forEach(id => {
    const task = entities[id];
    const timeSpentOnDay = _getTimeSpentOnDay(entities, task);

    Object.keys(timeSpentOnDay).forEach(dateStr => {
      const split = dateStr.split('-');
      const year = parseInt(split[0], 10);
      const month = parseInt(split[1], 10);
      const day = parseInt(split[2], 10);
      if (!worklog[year]) {
        worklog[year] = {
          timeSpent: 0,
          daysWorked: 0,
          monthWorked: 0,
          ent: {}
        };
      }
      if (!worklog[year].ent[month]) {
        worklog[year].ent[month] = {
          daysWorked: 0,
          timeSpent: 0,
          ent: {},
          weeks: [],
        };
      }
      if (!worklog[year].ent[month].ent[day]) {
        worklog[year].ent[month].ent[day] = {
          timeSpent: 0,
          logEntries: [],
          dateStr,
          dayStr: moment(dateStr).format('ddd'),
          workStart: startEnd.workStart && startEnd.workStart[dateStr],
          workEnd: startEnd.workEnd && startEnd.workEnd[dateStr],
        };

      }
      if (task.subTaskIds.length === 0) {
        const timeSpentForTask = +timeSpentOnDay[dateStr];
        worklog[year].ent[month].ent[day].timeSpent
          = worklog[year].ent[month].ent[day].timeSpent
          + timeSpentForTask;
        worklog[year].ent[month].timeSpent
          = worklog[year].ent[month].timeSpent
          + timeSpentForTask;
        worklog[year].timeSpent
          = worklog[year].timeSpent
          + timeSpentForTask;
        totalTimeSpent += timeSpentForTask;
      }

      worklog[year].ent[month].ent[day].logEntries.push({
        task,
        parentId: task.parentId,
        isNoRestore: noRestoreIds.includes(task.id),
        timeSpent: timeSpentOnDay[dateStr]
      });
    });
  });

  Object.keys(worklog).forEach((yearIN: string) => {
    const year: WorklogYear = worklog[yearIN];
    const monthKeys = Object.keys(year.ent);
    year.monthWorked = monthKeys.length;

    monthKeys.forEach((monthIN: string) => {
      const month: WorklogMonth = worklog[yearIN].ent[monthIN];
      const days = Object.keys(month.ent);
      month.daysWorked = days.length;
      year.daysWorked += days.length;

      const weeks = getWeeksInMonth((+monthIN - 1), +yearIN);

      month.weeks = weeks.map((week) => {
        const weekForMonth: WorklogWeek = {
          ...week,
          timeSpent: 0,
          daysWorked: 0,
          ent: {},
          weekNr: getWeekNumber(new Date(+yearIN, +monthIN - 1, week.start)),
        };

        days.forEach((dayIN: string) => {
          const day: WorklogDay = month.ent[dayIN];
          if (+dayIN >= week.start && +dayIN <= week.end) {
            weekForMonth.timeSpent += month.ent[dayIN].timeSpent;
            weekForMonth.daysWorked += 1;
            weekForMonth.ent[dayIN] = day;
          }
        });

        return weekForMonth;
      }).filter(week => week.daysWorked > 0);
    });
  });

  return {worklog, totalTimeSpent};
};
